import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import skillsConfig from "./utils/skills-config.json";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlatformEntry = {
  id: string;
  name: string;
  skillsDir: string;
  globalSkillsDir: string;
  isUniversal: boolean;
};

export type Scope = "project" | "global";

export type EditorType = "cursor" | "vscode" | "windsurf" | "antigravity" | "unknown";

export type McpServerDef = {
  label: string;
  description: string;
  key: string;
  config: Record<string, unknown>;
};

export type SkillInfo = {
  name: string;
  description: string;
  dirName: string;
};

type GitHubEntry = {
  name: string;
  type: "file" | "dir";
};

type GitHubFile = {
  content: string; // base64-encoded
  encoding: string;
};

// ── Editor detection ──────────────────────────────────────────────────────────

export function detectEditor(): EditorType {
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

export function getMcpFilePath(editor: EditorType): string {
  switch (editor) {
    case "cursor":      return ".cursor/mcp.json";
    case "windsurf":    return ".windsurf/mcp.json";
    case "antigravity": return ".agent/mcp_config.json";
    case "vscode":
    default:            return ".vscode/mcp.json";
  }
}

export function getMcpRootKey(editor: EditorType): "servers" | "mcpServers" {
  return editor === "vscode" ? "servers" : "mcpServers";
}

export function getEditorDisplayName(editor: EditorType): string | undefined {
  const names: Partial<Record<EditorType, string>> = {
    vscode: "VS Code", cursor: "Cursor", windsurf: "Windsurf", antigravity: "Antigravity",
  };
  return names[editor];
}

function stripTilde(dir: string): string {
  return dir.replace(/^~\/?/, "");
}

export function detectEditorPlatform(): string {
  const editor = detectEditor();
  switch (editor) {
    case "cursor":      return "cursor";
    case "windsurf":    return "windsurf";
    case "antigravity": return "antigravity";
    case "vscode":
    default:            return "github-copilot";
  }
}


export function getPlatformEntry(id: string): PlatformEntry | undefined {
  return (skillsConfig.platforms as PlatformEntry[]).find((p) => p.id === id);
}

export function getPlatformCovers(platform: PlatformEntry, scope: Scope): string | undefined {
  const dir = scope === "global" ? platform.globalSkillsDir : platform.skillsDir;
  const others = (skillsConfig.platforms as PlatformEntry[])
    .filter((p) => p.id !== platform.id && (scope === "global" ? p.globalSkillsDir : p.skillsDir) === dir)
    .map((p) => p.name);
  if (others.length === 0) { return undefined; }
  const MAX_SHOWN = 3;
  const shown = others.slice(0, MAX_SHOWN);
  const rest = others.length - MAX_SHOWN;
  return `Also covers: ${shown.join(", ")}${rest > 0 ? ` +${rest} more` : ""}`;
}

// ── GitHub API helpers ────────────────────────────────────────────────────────

const SKILLS_BASE = "https://api.github.com/repos/cloudinary-devs/skills/contents";

export async function githubFetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });

  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${url}`);
  }
  return response.json() as Promise<T>;
}

export function decodeBase64(encoded: string): string {
  return Buffer.from(encoded.replace(/\n/g, ""), "base64").toString("utf-8");
}

// ── Frontmatter helpers ───────────────────────────────────────────────────────

export function parseFrontmatter(content: string): Record<string, string> {
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

export function getBodyAfterFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

export function toMdcContent(content: string): string {
  return content.replace(/^(---\n)([\s\S]*?)(\n---)/, (_, open, body, close) => {
    const filtered = body
      .split("\n")
      .filter((line: string) => !line.startsWith("name:"))
      .join("\n");
    return `${open}${filtered}${close}`;
  });
}

// ── Skill fetching ────────────────────────────────────────────────────────────

export async function fetchSkillList(): Promise<SkillInfo[]> {
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

export async function fetchSkillContent(skillName: string): Promise<string> {
  const file = await githubFetchJson<GitHubFile>(
    `${SKILLS_BASE}/skills/${skillName}/SKILL.md`
  );
  return decodeBase64(file.content);
}

export async function fetchReferenceFiles(
  skillName: string
): Promise<Array<{ name: string; content: string }>> {
  let entries: GitHubEntry[];
  try {
    entries = await githubFetchJson<GitHubEntry[]>(
      `${SKILLS_BASE}/skills/${skillName}/references`
    );
  } catch {
    return [];
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

// ── Filesystem helpers ────────────────────────────────────────────────────────

export async function ensureDir(uri: vscode.Uri): Promise<void> {
  try { await vscode.workspace.fs.createDirectory(uri); } catch { /* already exists */ }
}

export async function writeWithOverwriteCheck(
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

// ── Skill installation — per IDE ──────────────────────────────────────────────

export async function installForClaudeCode(
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

export async function installForCursor(
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

export async function installForCopilot(
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

export async function installForUniversal(
  rootUri: vscode.Uri,
  skillName: string,
  skillContent: string,
  createdFiles: string[],
  errors: string[]
): Promise<void> {
  const skillFile = vscode.Uri.joinPath(
    rootUri, `.agents/skills/${skillName}/SKILL.md`
  );
  const written = await writeWithOverwriteCheck(
    skillFile, skillContent, `${skillName}/SKILL.md`
  );
  if (!written) { return; }
  createdFiles.push(`.agents/skills/${skillName}/SKILL.md`);

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
        rootUri, `.agents/skills/${skillName}/references/${ref.name}`
      );
      await ensureDir(vscode.Uri.joinPath(refUri, ".."));
      await vscode.workspace.fs.writeFile(refUri, Buffer.from(ref.content, "utf-8"));
      createdFiles.push(`.agents/skills/${skillName}/references/${ref.name}`);
    } catch (err: any) {
      errors.push(`${skillName}/references/${ref.name}: ${err.message}`);
    }
  }
}

export async function installForWindsurf(
  rootUri: vscode.Uri,
  skillName: string,
  skillContent: string,
  createdFiles: string[],
  errors: string[]
): Promise<void> {
  const skillFile = vscode.Uri.joinPath(
    rootUri, `.windsurf/skills/${skillName}/SKILL.md`
  );
  const written = await writeWithOverwriteCheck(
    skillFile, skillContent, `${skillName}/SKILL.md`
  );
  if (!written) { return; }
  createdFiles.push(`.windsurf/skills/${skillName}/SKILL.md`);

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
        rootUri, `.windsurf/skills/${skillName}/references/${ref.name}`
      );
      await ensureDir(vscode.Uri.joinPath(refUri, ".."));
      await vscode.workspace.fs.writeFile(refUri, Buffer.from(ref.content, "utf-8"));
      createdFiles.push(`.windsurf/skills/${skillName}/references/${ref.name}`);
    } catch (err: any) {
      errors.push(`${skillName}/references/${ref.name}: ${err.message}`);
    }
  }
}

export async function installSkill(
  rootUri: vscode.Uri,
  platform: PlatformEntry,
  scope: Scope,
  dirName: string,
  content: string,
  createdFiles: string[],
  errors: string[]
): Promise<void> {
  const base = scope === "global" ? os.homedir() : rootUri.fsPath;
  const rawDir = scope === "global" ? platform.globalSkillsDir : platform.skillsDir;
  const dir = scope === "global" ? stripTilde(rawDir) : rawDir;

  // Write SKILL.md (silent overwrite — matches `npx skills add -y` behaviour)
  const skillPath = path.join(dir, dirName, "SKILL.md");
  const skillUri = vscode.Uri.file(path.join(base, skillPath));
  await ensureDir(vscode.Uri.joinPath(skillUri, ".."));
  await vscode.workspace.fs.writeFile(skillUri, Buffer.from(content, "utf-8"));
  if (!createdFiles.includes(skillPath)) { createdFiles.push(skillPath); }

  // Fetch and write reference files
  let refs: Array<{ name: string; content: string }>;
  try {
    refs = await fetchReferenceFiles(dirName);
  } catch (err: any) {
    errors.push(`${dirName} references: ${err.message}`);
    return;
  }

  for (const ref of refs) {
    try {
      const refPath = path.join(dir, dirName, "references", ref.name);
      const refUri = vscode.Uri.file(path.join(base, refPath));
      await ensureDir(vscode.Uri.joinPath(refUri, ".."));
      await vscode.workspace.fs.writeFile(refUri, Buffer.from(ref.content, "utf-8"));
      if (!createdFiles.includes(refPath)) { createdFiles.push(refPath); }
    } catch (err: any) {
      errors.push(`${dirName}/references/${ref.name}: ${err.message}`);
    }
  }
}

// ── Status detection ──────────────────────────────────────────────────────────

export async function readInstalledSkillDirNames(
  rootUri: vscode.Uri,
  platform: PlatformEntry,
  skills: SkillInfo[]
): Promise<{ project: Set<string>; global: Set<string> }> {
  const projectBase = rootUri.fsPath;
  const globalBase = os.homedir();

  async function checkScope(base: string, dir: string): Promise<Set<string>> {
    const installed = new Set<string>();
    await Promise.all(
      skills.map(async (skill) => {
        try {
          const skillUri = vscode.Uri.file(path.join(base, dir, skill.dirName, "SKILL.md"));
          await vscode.workspace.fs.stat(skillUri);
          installed.add(skill.dirName);
        } catch {
          // not installed
        }
      })
    );
    return installed;
  }

  const projectDir = platform.skillsDir;
  const globalDir = stripTilde(platform.globalSkillsDir);

  const [project, global] = await Promise.all([
    checkScope(projectBase, projectDir),
    checkScope(globalBase, globalDir),
  ]);

  return { project, global };
}

export async function readConfiguredMcpServerKeys(
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

export const MCP_SERVERS: McpServerDef[] = [
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

// ── MCP installation helper ───────────────────────────────────────────────────

export async function installMcpServers(
  rootUri: vscode.Uri,
  editor: EditorType,
  selectedKeys: string[],
  createdFiles: string[]
): Promise<void> {
  const mcpFilePath = getMcpFilePath(editor);
  const rootKey = getMcpRootKey(editor);
  const mcpUri = vscode.Uri.joinPath(rootUri, mcpFilePath);
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
  for (const key of selectedKeys) {
    const def = MCP_SERVERS.find((s) => s.key === key);
    if (def) {
      servers[def.key] = def.config;
    }
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
