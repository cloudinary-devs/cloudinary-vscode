import * as vscode from "vscode";

// ── Types ────────────────────────────────────────────────────────────────────

type EditorType = "cursor" | "vscode" | "windsurf" | "antigravity" | "unknown";

type McpServerDef = {
  label: string;
  description: string;
  key: string;
  config: Record<string, unknown>; // same for all editors; root key differs by editor
};

type SkillInfo = {
  name: string;
  description: string;
  dirName: string; // GitHub directory name, used for API paths and local install paths
};

type GitHubEntry = {
  name: string;
  type: "file" | "dir";
};

type GitHubFile = {
  content: string; // base64-encoded
  encoding: string;
};

// ── Editor detection (same logic as legacy setupWorkspace) ───────────────────

function detectEditor(): EditorType {
  const uriScheme = vscode.env.uriScheme.toLowerCase();
  if (uriScheme === "cursor") { return "cursor"; }
  if (uriScheme === "windsurf") { return "windsurf"; }
  if (uriScheme === "antigravity" || uriScheme === "gemini") { return "antigravity"; }
  if (uriScheme === "vscode" || uriScheme === "vscode-insiders") { return "vscode"; }
  const appName = vscode.env.appName.toLowerCase();
  if (appName.includes("cursor")) { return "cursor"; }
  if (appName.includes("windsurf")) { return "windsurf"; }
  if (appName.includes("antigravity") || appName.includes("gemini")) { return "antigravity"; }
  if (appName.includes("visual studio code") || appName.includes("vscode")) { return "vscode"; }
  return "unknown";
}

function getMcpFilePath(editor: EditorType): string {
  switch (editor) {
    case "cursor":    return ".cursor/mcp.json";
    case "windsurf":  return ".windsurf/mcp.json";
    case "antigravity": return ".agent/mcp_config.json";
    case "vscode":
    default:          return ".vscode/mcp.json";
  }
}

// ── GitHub API helpers ───────────────────────────────────────────────────────

const SKILLS_BASE = "https://api.github.com/repos/cloudinary-devs/skills/contents";

async function githubFetchJson<T>(url: string): Promise<T> {
  const baseHeaders: Record<string, string> = { Accept: "application/vnd.github+json" };

  // Try unauthenticated first (works for public repos, no UI)
  let response = await fetch(url, { headers: baseHeaders });

  // On 401/403/404 attempt GitHub auth and retry once
  if (!response.ok && [401, 403, 404].includes(response.status)) {
    try {
      const session = await vscode.authentication.getSession("github", ["repo"], { createIfNone: true });
      if (session) {
        response = await fetch(url, {
          headers: { ...baseHeaders, Authorization: `Bearer ${session.accessToken}` },
        });
      }
    } catch {
      // auth declined or unavailable — fall through with original error
    }
  }

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${url}`);
  }
  return response.json() as Promise<T>;
}

function decodeBase64(encoded: string): string {
  // GitHub API returns base64 with newlines — strip them before decoding
  return Buffer.from(encoded.replace(/\n/g, ""), "base64").toString("utf-8");
}

// ── Frontmatter helpers ──────────────────────────────────────────────────────

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) { return {}; }
  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) { continue; }
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key) { result[key] = value; }
  }
  return result;
}

/** Returns everything after the closing --- of the frontmatter block. */
function getBodyAfterFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

/** Returns SKILL.md content with the `name:` line removed (Cursor .mdc format). */
function toMdcContent(content: string): string {
  return content.replace(/^(---\n)([\s\S]*?)(\n---)/, (_, open, body, close) => {
    const filtered = body
      .split("\n")
      .filter((line: string) => !line.startsWith("name:"))
      .join("\n");
    return `${open}${filtered}${close}`;
  });
}

// ── Skill fetching ───────────────────────────────────────────────────────────

async function fetchSkillList(): Promise<SkillInfo[]> {
  const entries = await githubFetchJson<GitHubEntry[]>(`${SKILLS_BASE}/skills`);
  const dirs = entries.filter((e) => e.type === "dir");

  const results = await Promise.all(
    dirs.map(async (dir): Promise<SkillInfo | null> => {
      try {
        const file = await githubFetchJson<GitHubFile>(
          `${SKILLS_BASE}/skills/${dir.name}/SKILL.md`
        );
        const content = decodeBase64(file.content);
        const fm = parseFrontmatter(content);
        return { name: fm.name || dir.name, description: fm.description || "", dirName: dir.name };
      } catch {
        return null;
      }
    })
  );

  return results.filter((s): s is SkillInfo => s !== null);
}

async function fetchSkillContent(skillName: string): Promise<string> {
  const file = await githubFetchJson<GitHubFile>(
    `${SKILLS_BASE}/skills/${skillName}/SKILL.md`
  );
  return decodeBase64(file.content);
}

async function fetchReferenceFiles(
  skillName: string
): Promise<Array<{ name: string; content: string }>> {
  let entries: GitHubEntry[];
  try {
    entries = await githubFetchJson<GitHubEntry[]>(
      `${SKILLS_BASE}/skills/${skillName}/references`
    );
  } catch {
    return []; // no references directory — that's fine
  }

  const results = await Promise.all(
    entries
      .filter((e) => e.type === "file")
      .map(async (e) => {
        try {
          const file = await githubFetchJson<GitHubFile>(
            `${SKILLS_BASE}/skills/${skillName}/references/${e.name}`
          );
          return { name: e.name, content: decodeBase64(file.content) };
        } catch {
          return null;
        }
      })
  );
  return results.filter((f): f is { name: string; content: string } => f !== null);
}

// ── Filesystem helpers ───────────────────────────────────────────────────────

async function ensureDir(uri: vscode.Uri): Promise<void> {
  try { await vscode.workspace.fs.createDirectory(uri); } catch { /* already exists */ }
}

/**
 * Writes content to uri. If the file already exists, prompts the user before
 * overwriting. Returns true if the file was written, false if the user skipped.
 */
async function writeWithOverwriteCheck(
  uri: vscode.Uri,
  content: string,
  label: string
): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    const answer = await vscode.window.showWarningMessage(
      `${label} already exists. Overwrite?`,
      "Yes",
      "No"
    );
    if (answer !== "Yes") { return false; }
  } catch {
    // file doesn't exist — proceed
  }
  await ensureDir(vscode.Uri.joinPath(uri, ".."));
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf-8"));
  return true;
}

// ── Skill installation — per IDE ─────────────────────────────────────────────

async function installForClaudeCode(
  rootUri: vscode.Uri,
  skillName: string,
  skillContent: string,
  createdFiles: string[],
  errors: string[]
): Promise<void> {
  const skillFile = vscode.Uri.joinPath(
    rootUri, `.claude/skills/${skillName}/SKILL.md`
  );
  const written = await writeWithOverwriteCheck(
    skillFile, skillContent, `${skillName}/SKILL.md`
  );
  if (!written) { return; }
  createdFiles.push(`.claude/skills/${skillName}/SKILL.md`);

  let refs: Array<{ name: string; content: string }>;
  try {
    refs = await fetchReferenceFiles(skillName);
  } catch (err: any) {
    errors.push(`${skillName} references: ${err.message}`);
    return;
  }

  for (const ref of refs) {
    try {
      const refUri = vscode.Uri.joinPath(
        rootUri, `.claude/skills/${skillName}/references/${ref.name}`
      );
      await ensureDir(vscode.Uri.joinPath(refUri, ".."));
      await vscode.workspace.fs.writeFile(refUri, Buffer.from(ref.content, "utf-8"));
      createdFiles.push(`.claude/skills/${skillName}/references/${ref.name}`);
    } catch (err: any) {
      errors.push(`${skillName}/references/${ref.name}: ${err.message}`);
    }
  }
}

async function installForCursor(
  rootUri: vscode.Uri,
  skillName: string,
  skillContent: string,
  createdFiles: string[]
): Promise<void> {
  const mdcUri = vscode.Uri.joinPath(rootUri, `.cursor/rules/${skillName}.mdc`);
  const written = await writeWithOverwriteCheck(
    mdcUri, toMdcContent(skillContent), `${skillName}.mdc`
  );
  if (written) { createdFiles.push(`.cursor/rules/${skillName}.mdc`); }
}

async function installForCopilot(
  rootUri: vscode.Uri,
  skillName: string,
  skillContent: string,
  createdFiles: string[]
): Promise<void> {
  const instructionsUri = vscode.Uri.joinPath(
    rootUri, ".github/copilot-instructions.md"
  );
  await ensureDir(vscode.Uri.joinPath(rootUri, ".github"));

  let existing = "";
  try {
    const bytes = await vscode.workspace.fs.readFile(instructionsUri);
    existing = Buffer.from(bytes).toString("utf-8");
  } catch {
    // new file
  }

  if (existing.includes(`## ${skillName}`)) {
    if (!createdFiles.includes(".github/copilot-instructions.md")) {
      createdFiles.push(".github/copilot-instructions.md");
    }
    return;
  }

  const body = getBodyAfterFrontmatter(skillContent);
  const section = `## ${skillName}\n\n${body}\n`;
  const separator = existing.length > 0 ? "\n" : "";

  await vscode.workspace.fs.writeFile(
    instructionsUri,
    Buffer.from(existing + separator + section, "utf-8")
  );

  if (!createdFiles.includes(".github/copilot-instructions.md")) {
    createdFiles.push(".github/copilot-instructions.md");
  }
}

// ── Status detection ─────────────────────────────────────────────────────────

/**
 * Returns the set of skill dirNames already installed for the given IDE target.
 * Errors reading individual paths are silently treated as "not installed".
 */
async function readInstalledSkillDirNames(
  rootUri: vscode.Uri,
  ideTargetLabel: string,
  skills: SkillInfo[]
): Promise<Set<string>> {
  const installed = new Set<string>();

  if (ideTargetLabel === "VS Code (Copilot)") {
    try {
      const uri = vscode.Uri.joinPath(rootUri, ".github/copilot-instructions.md");
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(bytes).toString("utf-8");
      for (const skill of skills) {
        if (content.includes(`## ${skill.name}`)) {
          installed.add(skill.dirName);
        }
      }
    } catch {
      // file not found — nothing installed
    }
    return installed;
  }

  await Promise.all(
    skills.map(async (skill) => {
      try {
        const checkPath =
          ideTargetLabel === "Claude Code"
            ? `.claude/skills/${skill.dirName}/SKILL.md`
            : `.cursor/rules/${skill.dirName}.mdc`;
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(rootUri, checkPath));
        installed.add(skill.dirName);
      } catch {
        // not installed
      }
    })
  );
  return installed;
}

/**
 * Returns the set of server keys already present in the MCP config file.
 * Returns an empty Set if the file doesn't exist or can't be parsed.
 */
async function readConfiguredMcpServerKeys(
  rootUri: vscode.Uri,
  mcpFilePath: string,
  rootKey: string
): Promise<Set<string>> {
  try {
    const uri = vscode.Uri.joinPath(rootUri, mcpFilePath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const config = JSON.parse(Buffer.from(bytes).toString("utf-8"));
    const servers = config[rootKey];
    if (servers && typeof servers === "object") {
      return new Set(Object.keys(servers));
    }
  } catch {
    // file not found or invalid JSON
  }
  return new Set();
}

// ── MCP Server definitions ────────────────────────────────────────────────────

const MCP_SERVERS: McpServerDef[] = [
  {
    label: "Cloudinary Asset Management",
    description: "Browse, upload, and manage media assets",
    key: "cloudinary-asset-mgmt",
    config: { url: "https://asset-management.mcp.cloudinary.com/mcp" },
  },
  {
    label: "Cloudinary Environment Config",
    description: "Configure upload presets, transformations, and settings",
    key: "cloudinary-env-config",
    config: { url: "https://environment-config.mcp.cloudinary.com/mcp" },
  },
  {
    label: "Cloudinary Structured Metadata",
    description: "Manage structured metadata fields and values",
    key: "cloudinary-smd",
    config: { url: "https://structured-metadata.mcp.cloudinary.com/mcp" },
  },
  {
    label: "Cloudinary Analysis",
    description: "AI-powered image and video analysis",
    key: "cloudinary-analysis",
    config: { url: "https://analysis.mcp.cloudinary.com/sse" },
  },
  {
    label: "MediaFlows",
    description: "AI-powered media workflows and automation",
    key: "mediaflows",
    config: {
      url: "https://mediaflows.mcp.cloudinary.com/v2/mcp",
      headers: {
        "cld-cloud-name": "your_cloud_name",
        "cld-api-key": "your_api_key",
        "cld-secret": "your_api_secret",
      },
    },
  },
];

// ── MCP Config ───────────────────────────────────────────────────────────────

async function createMcpConfig(
  rootUri: vscode.Uri,
  editor: EditorType,
  mcpFilePath: string,
  createdFiles: string[]
): Promise<void> {
  const rootKey = editor === "vscode" ? "servers" : "mcpServers";
  const configuredKeys = await readConfiguredMcpServerKeys(rootUri, mcpFilePath, rootKey);

  const selected = await vscode.window.showQuickPick(
    MCP_SERVERS.map((s) => ({
      label: s.label,
      description: s.description,
      detail: configuredKeys.has(s.key) ? "✓ already configured" : "Not configured",
      picked: !configuredKeys.has(s.key),
    })),
    { canPickMany: true, placeHolder: "Select MCP servers to configure" }
  );
  if (!selected || selected.length === 0) { return; }

  const selectedDefs = selected
    .map((item) => MCP_SERVERS.find((s) => s.label === item.label))
    .filter((s): s is McpServerDef => s !== undefined);

  const mcpUri = vscode.Uri.joinPath(rootUri, mcpFilePath);

  // Read and merge into existing config if present
  let config: Record<string, unknown> = {};
  try {
    const bytes = await vscode.workspace.fs.readFile(mcpUri);
    config = JSON.parse(Buffer.from(bytes).toString("utf-8"));
  } catch {
    // new file
  }

  if (!config[rootKey] || typeof config[rootKey] !== "object") {
    config[rootKey] = {};
  }
  const servers = config[rootKey] as Record<string, unknown>;

  for (const def of selectedDefs) {
    servers[def.key] = def.config;
  }

  await ensureDir(vscode.Uri.joinPath(mcpUri, ".."));
  await vscode.workspace.fs.writeFile(
    mcpUri,
    Buffer.from(JSON.stringify(config, null, 2), "utf-8")
  );
  if (!createdFiles.includes(mcpFilePath)) {
    createdFiles.push(mcpFilePath);
  }
}

// ── Command registration ─────────────────────────────────────────────────────

function registerConfigureAiTools(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.configureAiTools", async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("Please open a workspace folder first.");
        return;
      }
      const rootUri = workspaceFolders[0].uri;

      // ── Step 1: what to configure ──────────────────────────────────────────
      const options = await vscode.window.showQuickPick(
        [
          { label: "Skills", description: "Install Cloudinary agent skills", picked: true },
          { label: "MCP Config", description: "Add MCP server configuration file", picked: true },
        ],
        { canPickMany: true, placeHolder: "Select what to configure" }
      );
      if (!options || options.length === 0) { return; }

      const createdFiles: string[] = [];
      const errors: string[] = [];

      // ── Step 2: skills flow ────────────────────────────────────────────────
      if (options.some((o) => o.label === "Skills")) {
        let skills: SkillInfo[];
        try {
          skills = await fetchSkillList();
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to fetch skills: ${err.message}`);
          return;
        }

        // IDE target first — needed to check install status before showing skills
        const editor = detectEditor();
        const ideOptions: vscode.QuickPickItem[] = [
          { label: "Claude Code", description: "Install to .claude/skills/" },
          { label: "Cursor",      description: "Install to .cursor/rules/" },
          { label: "VS Code (Copilot)", description: "Append to .github/copilot-instructions.md" },
        ];
        const defaultLabel =
          editor === "cursor" ? "Cursor" :
          editor === "vscode" ? "VS Code (Copilot)" :
          "Claude Code";

        const qp = vscode.window.createQuickPick();
        qp.items = ideOptions;
        qp.activeItems = ideOptions.filter((o) => o.label === defaultLabel);
        qp.placeholder = "Select AI tool to install skills for";

        const ideTarget = await new Promise<vscode.QuickPickItem | undefined>((resolve) => {
          qp.onDidAccept(() => { resolve(qp.activeItems[0]); qp.dispose(); });
          qp.onDidHide(() => { resolve(undefined); qp.dispose(); });
          qp.show();
        });
        if (!ideTarget) { return; }

        const installedDirNames = await readInstalledSkillDirNames(rootUri, ideTarget.label, skills);

        const pickedSkills = await vscode.window.showQuickPick(
          skills.map((s) => ({
            label: s.name,
            description: s.description,
            detail: installedDirNames.has(s.dirName) ? "✓ installed" : "Not installed",
            picked: true,
          })),
          { canPickMany: true, placeHolder: "Select skills to install" }
        );
        if (!pickedSkills || pickedSkills.length === 0) { return; }

        for (const item of pickedSkills) {
          const skill = skills.find((s) => s.name === item.label);
          if (!skill) { continue; }
          let content: string;
          try {
            content = await fetchSkillContent(skill.dirName);
          } catch (err: any) {
            errors.push(`${skill.dirName}: ${err.message}`);
            continue;
          }

          if (ideTarget.label === "Claude Code") {
            await installForClaudeCode(rootUri, skill.dirName, content, createdFiles, errors);
          } else if (ideTarget.label === "Cursor") {
            try {
              await installForCursor(rootUri, skill.dirName, content, createdFiles);
            } catch (err) {
              errors.push(`${skill.dirName}: ${err instanceof Error ? err.message : String(err)}`);
            }
          } else {
            try {
              await installForCopilot(rootUri, skill.name, content, createdFiles);
            } catch (err) {
              errors.push(`${skill.name}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }

      // ── Step 3: MCP config flow ────────────────────────────────────────────
      if (options.some((o) => o.label === "MCP Config")) {
        const editor = detectEditor();
        await createMcpConfig(rootUri, editor, getMcpFilePath(editor), createdFiles);
      }

      // ── Step 4: feedback ───────────────────────────────────────────────────
      if (errors.length > 0) {
        vscode.window.showWarningMessage(
          `Some files could not be downloaded: ${errors.join(", ")}`
        );
      }

      if (createdFiles.length > 0) {
        const action = await vscode.window.showInformationMessage(
          `✅ Configured AI tools: ${createdFiles.join(", ")}`,
          "Open File"
        );
        if (action === "Open File") {
          const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.joinPath(rootUri, createdFiles[0])
          );
          vscode.window.showTextDocument(doc);
        }
      } else if (errors.length === 0) {
        vscode.window.showInformationMessage("No files were written — all targets already exist.");
      }
    })
  );
}

export default registerConfigureAiTools;
