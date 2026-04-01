# Configure AI Tools Webview Accordion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Configure AI Tools" VS Code QuickPick flow with an inline accordion panel inside the homescreen sidebar webview that lets users select and install skills and MCP servers without leaving the sidebar.

**Architecture:** Extract all business logic from `src/commands/configureAiTools.ts` into a new `src/aiToolsService.ts` module that is importable by both the command registration and the webview provider. The homescreen webview provider gains two new message handlers (`aiToolsExpanded`, `installAiTools`) that call the service, stream progress events back via `postMessage`, and return a final result. The client-side TypeScript in `src/webview/client/homescreen.ts` is fully rewritten to drive the accordion state machine.

**Tech Stack:** TypeScript, VS Code Extension API (`vscode.WebviewView`, `vscode.workspace.fs`, `vscode.authentication`), esbuild (bundler), Mocha + `@vscode/test-electron` (tests)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `src/aiToolsService.ts` | All types, constants, GitHub fetch, install, and read helpers; new `installMcpServers` function |
| **Modify** | `src/commands/configureAiTools.ts` | Import from `../aiToolsService`; keep `createMcpConfig` (simplified) and `registerConfigureAiTools` |
| **Modify** | `src/webview/homescreenView.ts` | Add accordion HTML/CSS; add `_cachedSkills`, `_handleAiToolsExpanded`, `_handleInstallAiTools`; update message switch |
| **Modify** | `src/webview/client/homescreen.ts` | Full rewrite: accordion state machine, IDE pill slider, message dispatch and handling |

---

## Task 1: Create `src/aiToolsService.ts` and slim down `src/commands/configureAiTools.ts`

**Files:**
- Create: `src/aiToolsService.ts`
- Modify: `src/commands/configureAiTools.ts`

### Step 1 — Create `src/aiToolsService.ts`

Create the file `/Users/nickbradley/dev/cloudinary-vscode/src/aiToolsService.ts` with the following content:

```typescript
import * as vscode from "vscode";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── GitHub API helpers ────────────────────────────────────────────────────────

const SKILLS_BASE = "https://api.github.com/repos/cloudinary-devs/skills/contents";

export async function githubFetchJson<T>(url: string): Promise<T> {
  const baseHeaders: Record<string, string> = { Accept: "application/vnd.github+json" };

  let response = await fetch(url, { headers: baseHeaders });

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

// ── Status detection ──────────────────────────────────────────────────────────

export async function readInstalledSkillDirNames(
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
  const isVscode = editor === "vscode";
  const rootKey = isVscode ? "servers" : "mcpServers";
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
```

### Step 2 — Overwrite `src/commands/configureAiTools.ts` to import from the service

Replace the entire file `/Users/nickbradley/dev/cloudinary-vscode/src/commands/configureAiTools.ts` with:

```typescript
import * as vscode from "vscode";
import {
  EditorType,
  McpServerDef,
  SkillInfo,
  MCP_SERVERS,
  detectEditor,
  getMcpFilePath,
  fetchSkillList,
  fetchSkillContent,
  installForClaudeCode,
  installForCursor,
  installForCopilot,
  readInstalledSkillDirNames,
  readConfiguredMcpServerKeys,
  installMcpServers,
  ensureDir,
} from "../aiToolsService";

// ── MCP Config (QuickPick flow) ───────────────────────────────────────────────

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

  const selectedKeys = selected
    .map((item) => MCP_SERVERS.find((s) => s.label === item.label))
    .filter((s): s is McpServerDef => s !== undefined)
    .map((s) => s.key);

  await installMcpServers(rootUri, editor, selectedKeys, createdFiles);
}

// ── Command registration ──────────────────────────────────────────────────────

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
```

### Step 3 — Verify types compile

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run check-types
```

Expected: no errors. If you see "Cannot find module '../aiToolsService'" it means the file wasn't saved to the right path. Double-check `src/aiToolsService.ts` exists.

### Step 4 — Commit

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && git add src/aiToolsService.ts src/commands/configureAiTools.ts && git commit -m "refactor: extract AI tools business logic into aiToolsService"
```

---

## Task 2: Add accordion HTML and CSS to `src/webview/homescreenView.ts`

**Files:**
- Modify: `src/webview/homescreenView.ts`

This task makes two changes to `homescreenView.ts`:
1. Adds accordion CSS to the `<style>` block inside `_getBodyContent()`
2. Replaces the existing `#hs-btn-ai-tools` button with the full accordion markup

### Step 1 — Add accordion CSS

In `_getBodyContent()`, locate the closing `</style>` tag. Insert the following CSS **before** that closing tag:

```css
        /* ── AI Tools accordion ── */
        #hs-btn-ai-tools { user-select: none; }
        #hs-btn-ai-tools.expanded {
          background: var(--vscode-list-hoverBackground);
          border-radius: 7px 7px 0 0;
        }

        .hs-ai-panel {
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.28s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 0 0 7px 7px;
          background: rgba(255,255,255,0.02);
          border-top: 1px solid transparent;
        }
        .hs-ai-panel.open {
          max-height: 520px;
          border-top-color: var(--vscode-panel-border, rgba(128,128,128,0.14));
        }
        .hs-ai-panel-inner {
          padding: 10px 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Loading skeletons */
        .hs-ai-loading { display: flex; flex-direction: column; gap: 6px; }
        .hs-skeleton {
          height: 22px;
          border-radius: 4px;
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 0%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.4s ease infinite;
        }
        .hs-skeleton--short { width: 55%; }
        .hs-skeleton--label { height: 10px; width: 38%; margin-bottom: 4px; }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Section headers */
        .hs-ai-section-head {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.9px;
          text-transform: uppercase;
          color: var(--vscode-descriptionForeground);
          opacity: 0.8;
          margin-bottom: 5px;
        }
        .hs-ai-section-head::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--vscode-panel-border, rgba(128,128,128,0.14));
        }

        /* IDE segmented control */
        .hs-ai-ide {
          position: relative;
          display: flex;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.14));
          border-radius: 5px;
          padding: 2px;
          margin-bottom: 7px;
        }
        .hs-ai-ide-pill {
          position: absolute;
          top: 2px;
          height: calc(100% - 4px);
          background: rgba(52,72,197,0.35);
          border: 1px solid rgba(52,72,197,0.5);
          border-radius: 3px;
          transition:
            left 0.15s cubic-bezier(0.4,0,0.2,1),
            width 0.15s cubic-bezier(0.4,0,0.2,1);
          pointer-events: none;
        }
        .hs-ai-ide-btn {
          flex: 1;
          padding: 3px 4px;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.2px;
          text-align: center;
          text-transform: uppercase;
          background: none;
          border: none;
          border-radius: 3px;
          color: var(--vscode-descriptionForeground);
          cursor: pointer;
          font-family: var(--vscode-font-family);
          position: relative;
          z-index: 1;
          transition: color 0.15s;
          white-space: nowrap;
        }
        .hs-ai-ide-btn.active { color: var(--vscode-foreground); }
        .hs-ai-ide-btn:hover:not(.active) { color: var(--vscode-foreground); opacity: 0.7; }

        /* Checklist items */
        .hs-ai-item {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 3px 4px 3px 2px;
          border-radius: 4px;
          transition: background 0.1s;
          cursor: pointer;
          animation: hs-row-in 0.18s ease both;
        }
        .hs-ai-item:hover { background: var(--vscode-list-hoverBackground); }
        .hs-ai-item:nth-child(1) { animation-delay: .05s; }
        .hs-ai-item:nth-child(2) { animation-delay: .09s; }
        .hs-ai-item:nth-child(3) { animation-delay: .13s; }
        .hs-ai-item:nth-child(4) { animation-delay: .17s; }
        .hs-ai-item:nth-child(5) { animation-delay: .21s; }
        @keyframes hs-row-in {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* Custom checkbox */
        .hs-ai-cb {
          appearance: none;
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          flex-shrink: 0;
          border: 1.5px solid var(--vscode-checkbox-border);
          border-radius: 2px;
          background: var(--vscode-checkbox-background);
          cursor: pointer;
          position: relative;
          transition: border-color 0.1s, background 0.1s;
        }
        .hs-ai-cb:checked {
          background: var(--vscode-button-background);
          border-color: var(--vscode-button-background);
        }
        .hs-ai-cb:checked::after {
          content: '';
          position: absolute;
          left: 2px; top: -1px;
          width: 5px; height: 8px;
          border: 1.5px solid var(--vscode-button-foreground);
          border-top: none;
          border-left: none;
          transform: rotate(45deg);
        }
        .hs-ai-cb:focus-visible {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: 1px;
        }

        .hs-ai-item-name {
          flex: 1;
          font-size: 11px;
          color: var(--vscode-foreground);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;
        }

        /* Status indicator */
        .hs-ai-item-status {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 9.5px;
          color: var(--vscode-descriptionForeground);
          white-space: nowrap;
        }
        .hs-ai-item-status::before {
          content: '';
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 1px;
          flex-shrink: 0;
        }
        .hs-ai-item-status--ok::before   { background: #4ade80; }
        .hs-ai-item-status--none::before { background: rgba(255,255,255,0.15); }

        /* Progress tick */
        .hs-ai-item-tick {
          flex-shrink: 0;
          width: 13px;
          height: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          animation: tick-in 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        @keyframes tick-in {
          from { opacity: 0; transform: scale(0); }
          to   { opacity: 1; transform: scale(1); }
        }
        .hs-ai-item-tick--ok  { color: #4ade80; }
        .hs-ai-item-tick--err { color: var(--vscode-errorForeground); }

        /* Apply button */
        .hs-ai-apply {
          width: 100%;
          padding: 6px 0;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3px;
          color: var(--vscode-button-foreground);
          background: var(--vscode-button-background);
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-family: var(--vscode-font-family);
          transition: opacity 0.12s;
          position: relative;
          overflow: hidden;
          margin-top: 2px;
        }
        .hs-ai-apply::after {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0);
          transition: background 0.12s;
        }
        .hs-ai-apply:hover::after { background: rgba(255,255,255,0.08); }
        .hs-ai-apply:disabled { opacity: 0.35; cursor: default; }
        .hs-ai-apply:disabled::after { background: none; }
        .hs-ai-apply:focus-visible {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: 2px;
        }

        /* Error banner */
        .hs-ai-error {
          font-size: 10.5px;
          color: var(--vscode-errorForeground);
          padding: 5px 7px;
          border-radius: 4px;
          background: rgba(241,76,76,0.08);
          border: 1px solid rgba(241,76,76,0.2);
        }

        .hidden { display: none !important; }
```

### Step 2 — Replace the AI Tools button HTML

In `_getBodyContent()`, find the existing button:

```html
          <button id="hs-btn-ai-tools" class="hs-action">
            <span class="hs-action-icon hs-action-icon--violet" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.734 1.734 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.734 1.734 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.734 1.734 0 0 0 3.407 2.31l.387-1.162zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Configure AI Tools</span>
              <span class="hs-action-desc">MCP servers &amp; agent skills</span>
            </span>
          </button>
```

Replace that entire button with:

```html
          <button id="hs-btn-ai-tools" class="hs-action" aria-expanded="false" aria-controls="hs-ai-panel">
            <span class="hs-action-icon hs-action-icon--violet" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.734 1.734 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.734 1.734 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.734 1.734 0 0 0 3.407 2.31l.387-1.162zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Configure AI Tools</span>
              <span class="hs-action-desc">MCP servers &amp; agent skills</span>
            </span>
            <svg class="hs-chevron" id="hs-ai-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <!-- AI Tools accordion panel -->
          <div class="hs-ai-panel" id="hs-ai-panel" role="region" aria-label="Configure AI Tools">

            <!-- Loading state -->
            <div class="hs-ai-panel-inner" id="hs-ai-state-loading">
              <div class="hs-ai-loading">
                <div class="hs-skeleton hs-skeleton--label"></div>
                <div class="hs-skeleton"></div>
                <div class="hs-skeleton"></div>
                <div class="hs-skeleton hs-skeleton--short"></div>
                <div style="height:6px"></div>
                <div class="hs-skeleton hs-skeleton--label"></div>
                <div class="hs-skeleton"></div>
                <div class="hs-skeleton"></div>
              </div>
            </div>

            <!-- Ready / applying state -->
            <div class="hs-ai-panel-inner hidden" id="hs-ai-state-ready">
              <div>
                <div class="hs-ai-section-head">Skills</div>
                <div class="hs-ai-ide" id="hs-ai-ide" role="group" aria-label="Target IDE">
                  <div class="hs-ai-ide-pill" id="hs-ai-ide-pill"></div>
                  <button class="hs-ai-ide-btn active" data-ide="Claude Code">Claude Code</button>
                  <button class="hs-ai-ide-btn" data-ide="Cursor">Cursor</button>
                  <button class="hs-ai-ide-btn" data-ide="VS Code (Copilot)">VS Code</button>
                </div>
                <div id="hs-ai-skills-list"></div>
              </div>
              <div>
                <div class="hs-ai-section-head">MCP Servers</div>
                <div id="hs-ai-mcp-list"></div>
              </div>
              <button class="hs-ai-apply" id="hs-ai-apply" disabled>Apply</button>
            </div>

            <!-- Done state -->
            <div class="hs-ai-panel-inner hidden" id="hs-ai-state-done">
              <div id="hs-ai-done-skills-list"></div>
              <div id="hs-ai-done-mcp-list"></div>
              <button class="hs-ai-apply" id="hs-ai-apply-again">Apply again</button>
            </div>

            <!-- Error state -->
            <div class="hs-ai-panel-inner hidden" id="hs-ai-state-error">
              <div class="hs-ai-error" id="hs-ai-error-msg"></div>
            </div>

          </div><!-- /hs-ai-panel -->
```

### Step 3 — Verify types compile

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run check-types
```

Expected: no errors.

### Step 4 — Commit

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && git add src/webview/homescreenView.ts && git commit -m "feat: add accordion HTML and CSS to homescreen sidebar"
```

---

## Task 3: Add message handlers to `src/webview/homescreenView.ts`

**Files:**
- Modify: `src/webview/homescreenView.ts`

This task wires up the extension-side message handling: receiving `aiToolsExpanded` and `installAiTools` from the webview, calling service functions, and posting responses back.

### Step 1 — Add the import for `aiToolsService`

At the top of `src/webview/homescreenView.ts`, after the existing imports, add:

```typescript
import {
  SkillInfo,
  McpServerDef,
  EditorType,
  MCP_SERVERS,
  detectEditor,
  getMcpFilePath,
  fetchSkillList,
  fetchSkillContent,
  readInstalledSkillDirNames,
  readConfiguredMcpServerKeys,
  installForClaudeCode,
  installForCursor,
  installForCopilot,
  installMcpServers,
} from "../aiToolsService";
```

### Step 2 — Add `_cachedSkills` property to the class

Inside `HomescreenViewProvider`, after the `private _webviewView` declaration, add:

```typescript
  private _cachedSkills: SkillInfo[] | undefined;
```

### Step 3 — Add `_handleAiToolsExpanded` method

Add this method to `HomescreenViewProvider` (before the closing `}`):

```typescript
  private async _handleAiToolsExpanded(): Promise<void> {
    const view = this._webviewView;
    if (!view) { return; }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      view.webview.postMessage({
        command: "aiToolsData",
        error: "Please open a workspace folder first.",
      });
      return;
    }
    const rootUri = workspaceFolders[0].uri;

    try {
      // Fetch skills once; cache for subsequent opens
      if (!this._cachedSkills) {
        this._cachedSkills = await fetchSkillList();
      }
      const skills = this._cachedSkills;

      const ideLabels: string[] = ["Claude Code", "Cursor", "VS Code (Copilot)"];

      // Pre-compute installed status for all 3 IDEs
      const installedByIde: Record<string, string[]> = {};
      await Promise.all(
        ideLabels.map(async (label) => {
          const installedSet = await readInstalledSkillDirNames(rootUri, label, skills);
          installedByIde[label] = [...installedSet];
        })
      );

      // MCP servers — use detected editor for the config file path
      const editor = detectEditor();
      const mcpFilePath = getMcpFilePath(editor);
      const rootKey = editor === "vscode" ? "servers" : "mcpServers";
      const configuredMcpSet = await readConfiguredMcpServerKeys(rootUri, mcpFilePath, rootKey);

      const detectedIde =
        editor === "cursor" ? "Cursor" :
        editor === "vscode" ? "VS Code (Copilot)" :
        "Claude Code";

      view.webview.postMessage({
        command: "aiToolsData",
        skills: skills.map((s) => ({ name: s.name, description: s.description, dirName: s.dirName })),
        installedByIde,
        mcpServers: MCP_SERVERS.map((s) => ({ key: s.key, label: s.label, description: s.description })),
        configuredMcpKeys: [...configuredMcpSet],
        detectedIde,
      });
    } catch (err: any) {
      view.webview.postMessage({
        command: "aiToolsData",
        error: err.message ?? String(err),
      });
    }
  }
```

### Step 4 — Add `_handleInstallAiTools` method

Add this method to `HomescreenViewProvider` (after `_handleAiToolsExpanded`):

```typescript
  private async _handleInstallAiTools(
    skills: string[],
    ideTarget: string,
    mcpServers: string[]
  ): Promise<void> {
    const view = this._webviewView;
    if (!view) { return; }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      view.webview.postMessage({ command: "aiToolsResult", errors: ["No workspace folder open."] });
      return;
    }
    const rootUri = workspaceFolders[0].uri;
    const errors: string[] = [];

    // Install skills
    const cachedSkills = this._cachedSkills ?? [];
    for (const dirName of skills) {
      const skillInfo = cachedSkills.find((s) => s.dirName === dirName);
      if (!skillInfo) { continue; }

      let content: string;
      try {
        // fetchSkillContent is imported from aiToolsService
        const { fetchSkillContent: _fetch } = await import("../aiToolsService");
        content = await _fetch(dirName);
      } catch (err: any) {
        errors.push(`${dirName}: ${err.message}`);
        view.webview.postMessage({ command: "aiToolsProgress", item: dirName, status: "error" });
        continue;
      }

      const createdFiles: string[] = [];
      try {
        if (ideTarget === "Claude Code") {
          await installForClaudeCode(rootUri, dirName, content, createdFiles, errors);
        } else if (ideTarget === "Cursor") {
          await installForCursor(rootUri, dirName, content, createdFiles);
        } else {
          await installForCopilot(rootUri, skillInfo.name, content, createdFiles);
        }
        view.webview.postMessage({ command: "aiToolsProgress", item: dirName, status: "done" });
      } catch (err: any) {
        errors.push(`${dirName}: ${err.message}`);
        view.webview.postMessage({ command: "aiToolsProgress", item: dirName, status: "error" });
      }
    }

    // Install MCP servers
    if (mcpServers.length > 0) {
      const editor = detectEditor();
      const createdFiles: string[] = [];
      try {
        await installMcpServers(rootUri, editor, mcpServers, createdFiles);
        for (const key of mcpServers) {
          view.webview.postMessage({ command: "aiToolsProgress", item: key, status: "done" });
        }
      } catch (err: any) {
        errors.push(`MCP: ${err.message}`);
        for (const key of mcpServers) {
          view.webview.postMessage({ command: "aiToolsProgress", item: key, status: "error" });
        }
      }
    }

    // Invalidate cached installed state so next open re-reads disk
    this._cachedSkills = undefined;

    view.webview.postMessage({ command: "aiToolsResult", errors });
  }
```

### Step 5 — Update the `onDidReceiveMessage` switch

In `resolveWebviewView`, the message handler currently has a `switch` block. The message type must be widened and two new cases must be added. Replace the entire `onDidReceiveMessage` call with:

```typescript
    webviewView.webview.onDidReceiveMessage(
      (message: { command: string; skills?: string[]; ideTarget?: string; mcpServers?: string[] }) => {
        switch (message.command) {
          case "openGlobalConfig":
            vscode.commands.executeCommand("cloudinary.openGlobalConfig");
            break;
          case "showLibrary":
            vscode.commands.executeCommand("cloudinary.showLibrary");
            break;
          case "openUploadWidget":
            vscode.commands.executeCommand("cloudinary.openUploadWidget");
            break;
          case "openWelcomeScreen":
            vscode.commands.executeCommand("cloudinary.openWelcomeScreen");
            break;
          case "aiToolsExpanded":
            this._handleAiToolsExpanded();
            break;
          case "installAiTools":
            this._handleInstallAiTools(
              message.skills ?? [],
              message.ideTarget ?? "Claude Code",
              message.mcpServers ?? []
            );
            break;
        }
      }
    );
```

Note: The `case "configureAiTools"` is intentionally removed — the old command dispatch is replaced by the new inline flow.

### Step 6 — Fix the dynamic import of `fetchSkillContent`

The dynamic `import()` inside `_handleInstallAiTools` in Step 4 is unnecessarily complex and won't work well with esbuild. Replace the entire `try` block that fetches skill content with a direct call using the top-level import. Change this section inside the `for (const dirName of skills)` loop in `_handleInstallAiTools`:

```typescript
      let content: string;
      try {
        // fetchSkillContent is imported from aiToolsService
        const { fetchSkillContent: _fetch } = await import("../aiToolsService");
        content = await _fetch(dirName);
      } catch (err: any) {
        errors.push(`${dirName}: ${err.message}`);
        view.webview.postMessage({ command: "aiToolsProgress", item: dirName, status: "error" });
        continue;
      }
```

With this (using the top-level import):

```typescript
      let content: string;
      try {
        content = await fetchSkillContent(dirName);
      } catch (err: any) {
        errors.push(`${dirName}: ${err.message}`);
        view.webview.postMessage({ command: "aiToolsProgress", item: dirName, status: "error" });
        continue;
      }
```

Also add `fetchSkillContent` to the import list added in Step 1 of this task (it should already be there if you followed Step 1 exactly).

### Step 7 — Verify types compile

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run check-types
```

Expected: no errors.

### Step 8 — Commit

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && git add src/webview/homescreenView.ts && git commit -m "feat: add aiToolsExpanded and installAiTools message handlers to HomescreenViewProvider"
```

---

## Task 4: Rewrite `src/webview/client/homescreen.ts`

**Files:**
- Modify: `src/webview/client/homescreen.ts`

Replace the entire file `/Users/nickbradley/dev/cloudinary-vscode/src/webview/client/homescreen.ts` with the client-side accordion state machine.

### Step 1 — Write the new `homescreen.ts`

Replace the file contents with:

```typescript
import { initCommon, getVSCode } from "./common";

// ── Types (mirrored from aiToolsService — no import possible in webview client) ──

interface SkillInfo {
  name: string;
  description: string;
  dirName: string;
}

interface McpServerInfo {
  key: string;
  label: string;
  description: string;
}

interface AiToolsDataMessage {
  command: "aiToolsData";
  skills: SkillInfo[];
  installedByIde: Record<string, string[]>; // ideLabel → array of dirNames
  mcpServers: McpServerInfo[];
  configuredMcpKeys: string[];
  detectedIde: string;
  error?: string;
}

interface AiToolsProgressMessage {
  command: "aiToolsProgress";
  item: string;   // skill dirName or MCP key
  status: "done" | "error";
}

interface AiToolsResultMessage {
  command: "aiToolsResult";
  errors: string[];
}

type InboundMessage = AiToolsDataMessage | AiToolsProgressMessage | AiToolsResultMessage;

// ── Module state ──────────────────────────────────────────────────────────────

let _isOpen = false;
let _dataFetched = false;
let _cachedData: Omit<AiToolsDataMessage, "command"> | null = null;
let _activeIde = "Claude Code";

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function show(id: string): void {
  el(id).classList.remove("hidden");
}

function hide(id: string): void {
  el(id).classList.add("hidden");
}

// ── State rendering ───────────────────────────────────────────────────────────

function showPanelState(state: "loading" | "ready" | "done" | "error"): void {
  for (const s of ["loading", "ready", "done", "error"] as const) {
    const elem = el(`hs-ai-state-${s}`);
    if (elem) {
      elem.classList.toggle("hidden", s !== state);
    }
  }
}

// ── IDE pill ──────────────────────────────────────────────────────────────────

function movePill(btn: HTMLElement): void {
  const pill = el<HTMLElement>("hs-ai-ide-pill");
  if (!pill) { return; }
  pill.style.left = btn.offsetLeft + "px";
  pill.style.width = btn.offsetWidth + "px";
}

function initPill(): void {
  const activeBtn = document.querySelector<HTMLElement>(".hs-ai-ide-btn.active");
  if (activeBtn) { movePill(activeBtn); }
}

// ── Checklist rendering ───────────────────────────────────────────────────────

function renderSkillRows(
  skills: SkillInfo[],
  installedDirNames: string[]
): void {
  const list = el("hs-ai-skills-list");
  if (!list) { return; }
  const installedSet = new Set(installedDirNames);
  list.innerHTML = skills
    .map((s) => {
      const isInstalled = installedSet.has(s.dirName);
      const statusClass = isInstalled ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
      const statusText = isInstalled ? "installed" : "—";
      return `<label class="hs-ai-item">
        <input type="checkbox" class="hs-ai-cb" data-skill="${s.dirName}" ${isInstalled ? "" : "checked"}>
        <span class="hs-ai-item-name" title="${s.description}">${s.name}</span>
        <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
      </label>`;
    })
    .join("");
  list.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((cb) => {
    cb.addEventListener("change", updateApplyButton);
  });
}

function renderMcpRows(
  servers: McpServerInfo[],
  configuredKeys: string[]
): void {
  const list = el("hs-ai-mcp-list");
  if (!list) { return; }
  const configuredSet = new Set(configuredKeys);
  list.innerHTML = servers
    .map((s) => {
      const isConfigured = configuredSet.has(s.key);
      const statusClass = isConfigured ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
      const statusText = isConfigured ? "configured" : "—";
      return `<label class="hs-ai-item">
        <input type="checkbox" class="hs-ai-cb" data-mcp="${s.key}" ${isConfigured ? "" : "checked"}>
        <span class="hs-ai-item-name" title="${s.description}">${s.label}</span>
        <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
      </label>`;
    })
    .join("");
  list.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((cb) => {
    cb.addEventListener("change", updateApplyButton);
  });
}

function updateApplyButton(): void {
  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (!applyBtn) { return; }
  const anyChecked = [...document.querySelectorAll<HTMLInputElement>(".hs-ai-cb")]
    .some((c) => c.checked && !c.disabled);
  applyBtn.disabled = !anyChecked;
}

// ── Accordion toggle ──────────────────────────────────────────────────────────

function toggleAccordion(): void {
  _isOpen = !_isOpen;

  const panel = el("hs-ai-panel");
  const btn = el("hs-btn-ai-tools");
  const chevron = el("hs-ai-chevron");

  panel.classList.toggle("open", _isOpen);
  btn.classList.toggle("expanded", _isOpen);
  btn.setAttribute("aria-expanded", String(_isOpen));
  chevron.classList.toggle("hs-chevron--open", _isOpen);

  if (_isOpen && !_dataFetched) {
    _dataFetched = true;
    showPanelState("loading");
    getVSCode()?.postMessage({ command: "aiToolsExpanded" });
  }

  if (_isOpen) {
    // Re-position pill after layout settles (accordion may have just opened)
    panel.addEventListener("transitionend", () => {
      initPill();
    }, { once: true });
  }
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function handleApply(): void {
  if (!_cachedData) { return; }

  const skillCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-skill]");
  const mcpCheckboxes = document.querySelectorAll<HTMLInputElement>(".hs-ai-cb[data-mcp]");

  const selectedSkills = [...skillCheckboxes]
    .filter((c) => c.checked)
    .map((c) => c.dataset.skill!);

  const selectedMcpKeys = [...mcpCheckboxes]
    .filter((c) => c.checked)
    .map((c) => c.dataset.mcp!);

  // Switch to applying visual: disable checkboxes and apply button
  document.querySelectorAll<HTMLInputElement>(".hs-ai-cb").forEach((c) => { c.disabled = true; });
  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = "Applying…";
  }

  getVSCode()?.postMessage({
    command: "installAiTools",
    skills: selectedSkills,
    ideTarget: _activeIde,
    mcpServers: selectedMcpKeys,
  });
}

// ── Message handling ──────────────────────────────────────────────────────────

function handleAiToolsData(msg: AiToolsDataMessage): void {
  if (msg.error) {
    el("hs-ai-error-msg").textContent = msg.error;
    showPanelState("error");
    return;
  }

  _cachedData = {
    skills: msg.skills,
    installedByIde: msg.installedByIde,
    mcpServers: msg.mcpServers,
    configuredMcpKeys: msg.configuredMcpKeys,
    detectedIde: msg.detectedIde,
  };

  // Set active IDE to detected editor
  _activeIde = msg.detectedIde;
  document.querySelectorAll<HTMLElement>(".hs-ai-ide-btn").forEach((btn) => {
    const isActive = btn.dataset.ide === _activeIde;
    btn.classList.toggle("active", isActive);
  });

  renderSkillRows(msg.skills, msg.installedByIde[_activeIde] ?? []);
  renderMcpRows(msg.mcpServers, msg.configuredMcpKeys);

  showPanelState("ready");
  updateApplyButton();

  requestAnimationFrame(() => { initPill(); });
}

function handleAiToolsProgress(msg: AiToolsProgressMessage): void {
  // Find the row by data-skill or data-mcp attribute
  const cb = document.querySelector<HTMLInputElement>(
    `[data-skill="${msg.item}"], [data-mcp="${msg.item}"]`
  );
  if (!cb) { return; }

  const row = cb.closest(".hs-ai-item");
  if (!row) { return; }

  // Remove existing tick if any
  row.querySelector(".hs-ai-item-tick")?.remove();

  const tick = document.createElement("span");
  tick.className = `hs-ai-item-tick hs-ai-item-tick--${msg.status === "done" ? "ok" : "err"}`;
  tick.textContent = msg.status === "done" ? "✓" : "✕";
  row.appendChild(tick);
}

function handleAiToolsResult(msg: AiToolsResultMessage): void {
  // Force a re-fetch next time the panel opens so installed state is fresh
  _dataFetched = false;
  _cachedData = null;

  // Build done state: collect rows with ticks and show them
  const doneSkillsDiv = el("hs-ai-done-skills-list");
  const doneMcpDiv = el("hs-ai-done-mcp-list");

  if (doneSkillsDiv) {
    const rows = document.querySelectorAll<HTMLElement>("#hs-ai-skills-list .hs-ai-item");
    doneSkillsDiv.innerHTML = "";
    rows.forEach((row) => {
      const tick = row.querySelector(".hs-ai-item-tick");
      if (!tick) { return; }
      const name = row.querySelector(".hs-ai-item-name")?.textContent ?? "";
      const isOk = tick.classList.contains("hs-ai-item-tick--ok");
      const statusClass = isOk ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
      const statusText = isOk ? "installed" : "error";
      doneSkillsDiv.insertAdjacentHTML(
        "beforeend",
        `<div class="hs-ai-item">
          <span class="hs-ai-item-tick hs-ai-item-tick--${isOk ? "ok" : "err"}">${isOk ? "✓" : "✕"}</span>
          <span class="hs-ai-item-name">${name}</span>
          <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
        </div>`
      );
    });
  }

  if (doneMcpDiv) {
    const rows = document.querySelectorAll<HTMLElement>("#hs-ai-mcp-list .hs-ai-item");
    doneMcpDiv.innerHTML = "";
    rows.forEach((row) => {
      const tick = row.querySelector(".hs-ai-item-tick");
      if (!tick) { return; }
      const name = row.querySelector(".hs-ai-item-name")?.textContent ?? "";
      const isOk = tick.classList.contains("hs-ai-item-tick--ok");
      const statusClass = isOk ? "hs-ai-item-status--ok" : "hs-ai-item-status--none";
      const statusText = isOk ? "configured" : "error";
      doneMcpDiv.insertAdjacentHTML(
        "beforeend",
        `<div class="hs-ai-item">
          <span class="hs-ai-item-tick hs-ai-item-tick--${isOk ? "ok" : "err"}">${isOk ? "✓" : "✕"}</span>
          <span class="hs-ai-item-name">${name}</span>
          <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
        </div>`
      );
    });
  }

  showPanelState("done");
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init(): void {
  initCommon();

  // Standard action buttons (non-accordion)
  document.querySelectorAll<HTMLElement>(".hs-action:not(#hs-btn-ai-tools)").forEach((btn) => {
    btn.addEventListener("click", () => {
      getVSCode()?.postMessage({ command: btn.dataset.command });
    });
  });

  // Setup banner configure button
  document.getElementById("hs-btn-configure")?.addEventListener("click", () => {
    getVSCode()?.postMessage({ command: "openGlobalConfig" });
  });

  // Welcome guide footer link
  document.getElementById("hs-link-welcome")?.addEventListener("click", () => {
    getVSCode()?.postMessage({ command: "openWelcomeScreen" });
  });

  // Browse Library
  document.getElementById("hs-btn-library")?.addEventListener("click", () => {
    getVSCode()?.postMessage({ command: "showLibrary" });
  });

  // Upload
  document.getElementById("hs-btn-upload")?.addEventListener("click", () => {
    getVSCode()?.postMessage({ command: "openUploadWidget" });
  });

  // Accordion toggle
  el("hs-btn-ai-tools").addEventListener("click", toggleAccordion);

  // IDE selector buttons
  document.querySelectorAll<HTMLElement>(".hs-ai-ide-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!_cachedData) { return; }
      document.querySelectorAll<HTMLElement>(".hs-ai-ide-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      movePill(btn);
      _activeIde = btn.dataset.ide ?? "Claude Code";
      renderSkillRows(_cachedData.skills, _cachedData.installedByIde[_activeIde] ?? []);
      updateApplyButton();
    });
  });

  // Apply button
  el<HTMLButtonElement>("hs-ai-apply")?.addEventListener("click", handleApply);

  // Apply again button (done state)
  el<HTMLButtonElement>("hs-ai-apply-again")?.addEventListener("click", () => {
    // Re-open: reset state and re-fetch
    _isOpen = false;
    toggleAccordion();
  });

  // VS Code → webview messages
  window.addEventListener("message", (event: MessageEvent<InboundMessage>) => {
    const msg = event.data;
    switch (msg.command) {
      case "aiToolsData":
        handleAiToolsData(msg as AiToolsDataMessage);
        break;
      case "aiToolsProgress":
        handleAiToolsProgress(msg as AiToolsProgressMessage);
        break;
      case "aiToolsResult":
        handleAiToolsResult(msg as AiToolsResultMessage);
        break;
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
```

### Step 2 — Verify types compile

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run check-types
```

Expected: no errors.

### Step 3 — Build and run tests

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run compile-tests && npm run test
```

Expected: all existing tests pass. The test suite exercises extension activation and tree view — neither of which was structurally changed.

### Step 4 — Commit

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && git add src/webview/client/homescreen.ts && git commit -m "feat: rewrite homescreen client with AI tools accordion state machine"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Covered by |
|---|---|
| Replace QuickPick with inline accordion | Task 2 (HTML/CSS), Task 3 (handlers), Task 4 (client) |
| Toggle accordion on "Configure AI Tools" row click | Task 4 `toggleAccordion()` |
| Loading skeleton → Ready checklist | Task 4 `showPanelState`, `handleAiToolsData` |
| Skills section: IDE segmented control (3 buttons) | Task 2 HTML, Task 4 IDE button listeners |
| MCP Servers section: checklist per server | Task 2 HTML, Task 4 `renderMcpRows` |
| Apply button at bottom | Task 2 HTML, Task 4 `handleApply` |
| `aiToolsExpanded` post from webview | Task 4 `toggleAccordion` |
| `aiToolsData` response (skills, installedByIde, mcpServers, configuredMcpKeys, detectedIde) | Task 3 `_handleAiToolsExpanded` |
| Error case: `aiToolsData` with `error` field | Task 3 `_handleAiToolsExpanded` catch, Task 4 `handleAiToolsData` |
| `installAiTools` post with skills, ideTarget, mcpServers | Task 4 `handleApply` |
| `aiToolsProgress` per item | Task 3 `_handleInstallAiTools`, Task 4 `handleAiToolsProgress` |
| `aiToolsResult` final message | Task 3 `_handleInstallAiTools`, Task 4 `handleAiToolsResult` |
| IDE pill slider with JS positioning | Task 4 `movePill`, `initPill` |
| Applying state: disabled checkboxes + "Applying…" text | Task 4 `handleApply` |
| Done state: show installed/configured items with tick | Task 4 `handleAiToolsResult` |
| "Apply again" resets to re-fetch | Task 4 `hs-ai-apply-again` handler |
| CSS uses `--vscode-*` variables only | Task 2 CSS (hardcoded colours only in gradient/status-dot where VS Code has no equivalent variable) |
| Business logic shared between command and webview | Task 1 `src/aiToolsService.ts` |
| `installMcpServers` new function in service | Task 1 |

### Placeholder scan

No TBDs, no "similar to" references, no steps without code blocks.

### Type consistency

- `SkillInfo.dirName` — defined in `aiToolsService.ts` Task 1, used identically in Task 3 (`_handleAiToolsExpanded`, `_handleInstallAiTools`) and Task 4 (`renderSkillRows`, `handleAiToolsProgress`).
- `McpServerDef.key` / `McpServerInfo.key` — `McpServerDef` in service; the webview-facing `McpServerInfo` mirrors `{ key, label, description }` exactly as sent by `_handleAiToolsExpanded`.
- `installedByIde` — `Record<string, string[]>` sent from Task 3, read as `Record<string, string[]>` in Task 4.
- `AiToolsDataMessage.installedByIde` — indexed by `_activeIde` string in `renderSkillRows` calls; IDE button `data-ide` values in HTML (`"Claude Code"`, `"Cursor"`, `"VS Code (Copilot)"`) match the keys produced by `_handleAiToolsExpanded`'s `ideLabels` array.
- `showPanelState` IDs: `hs-ai-state-loading`, `hs-ai-state-ready`, `hs-ai-state-done`, `hs-ai-state-error` — all four exist in the HTML added in Task 2.
- Apply button ID `hs-ai-apply` — present in HTML (Task 2) and queried in client (Task 4).
- `hs-ai-apply-again` — present in HTML done state (Task 2) and queried in client (Task 4).
