# Configure AI Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stub `setupWorkspace` command with a fully working `cloudinary.configureAiTools` command that fetches Cloudinary agent skills from GitHub and installs them for Claude Code, Cursor, or VS Code Copilot, and optionally scaffolds an MCP config file.

**Architecture:** A new `src/commands/configureAiTools.ts` module contains all logic: GitHub API fetching (unauthenticated `fetch`), frontmatter parsing, IDE-specific skill installation, and MCP config scaffolding. The homescreen "Configure AI Tools" button (currently disabled/stub) is wired to trigger this command via a webview message.

**Tech Stack:** TypeScript, VS Code Extension API, GitHub Contents API (unauthenticated), Node.js `fetch` (available in VS Code's Node 18+ extension host)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/commands/configureAiTools.ts` | All command logic: fetch, parse, install, MCP config |
| Modify | `src/commands/registerCommands.ts` | Import and call `registerConfigureAiTools` |
| Modify | `package.json` | Add `cloudinary.configureAiTools` command contribution |
| Modify | `src/webview/homescreenView.ts` | Add `configureAiTools` message case; enable button (add ID, remove `disabled`) |
| Modify | `src/webview/client/homescreen.ts` | Wire click listener on `hs-btn-ai-tools` |

---

### Task 1: Create `configureAiTools.ts`

**Files:**
- Create: `src/commands/configureAiTools.ts`

This is the main new file. It contains every helper and the command registration.

- [ ] **Step 1: Create the file with all imports, types, and utility functions**

Create `src/commands/configureAiTools.ts` with the following content:

```typescript
import * as vscode from "vscode";

// ── Types ────────────────────────────────────────────────────────────────────

type EditorType = "cursor" | "vscode" | "windsurf" | "antigravity" | "unknown";

type SkillInfo = {
  name: string;
  description: string;
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
  const response = await fetch(url, {
    headers: { Accept: "application/vnd.github+json" },
  });
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
  return content.replace(/^(---\n)([\s\S]*?)(\n---)/m, (_, open, body, close) => {
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
        return { name: fm.name || dir.name, description: fm.description || "" };
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

  const files = await Promise.all(
    entries
      .filter((e) => e.type === "file")
      .map(async (e) => {
        const file = await githubFetchJson<GitHubFile>(
          `${SKILLS_BASE}/skills/${skillName}/references/${e.name}`
        );
        return { name: e.name, content: decodeBase64(file.content) };
      })
  );
  return files;
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

// ── MCP Config ───────────────────────────────────────────────────────────────

async function createMcpConfig(
  rootUri: vscode.Uri,
  mcpFilePath: string,
  createdFiles: string[]
): Promise<void> {
  const mcpUri = vscode.Uri.joinPath(rootUri, mcpFilePath);
  const written = await writeWithOverwriteCheck(
    mcpUri,
    JSON.stringify({ mcpServers: {} }, null, 2),
    mcpFilePath
  );
  if (written) { createdFiles.push(mcpFilePath); }
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

        const pickedSkills = await vscode.window.showQuickPick(
          skills.map((s) => ({ label: s.name, description: s.description, picked: true })),
          { canPickMany: true, placeHolder: "Select skills to install" }
        );
        if (!pickedSkills || pickedSkills.length === 0) { return; }

        // IDE target — pre-select based on detected editor
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

        for (const item of pickedSkills) {
          const skill = skills.find((s) => s.name === item.label)!;
          let content: string;
          try {
            content = await fetchSkillContent(skill.name);
          } catch (err: any) {
            errors.push(`${skill.name}: ${err.message}`);
            continue;
          }

          if (ideTarget.label === "Claude Code") {
            await installForClaudeCode(rootUri, skill.name, content, createdFiles, errors);
          } else if (ideTarget.label === "Cursor") {
            await installForCursor(rootUri, skill.name, content, createdFiles);
          } else {
            await installForCopilot(rootUri, skill.name, content, createdFiles);
          }
        }
      }

      // ── Step 3: MCP config flow ────────────────────────────────────────────
      if (options.some((o) => o.label === "MCP Config")) {
        const editor = detectEditor();
        await createMcpConfig(rootUri, getMcpFilePath(editor), createdFiles);
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
      }
    })
  );
}

export default registerConfigureAiTools;
```

- [ ] **Step 2: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/commands/configureAiTools.ts
git commit -m "feat: add configureAiTools command with GitHub skill fetch and IDE-specific installation"
```

---

### Task 2: Register command in `registerCommands.ts` and `package.json`

**Files:**
- Modify: `src/commands/registerCommands.ts`
- Modify: `package.json`

- [ ] **Step 1: Add import and call in `registerCommands.ts`**

In `src/commands/registerCommands.ts`, add after the existing imports:

```typescript
import registerConfigureAiTools from "./configureAiTools";
```

And add at the end of `registerAllCommands`, after `registerWelcomeScreen(context, provider)`:

```typescript
  registerConfigureAiTools(context);
```

- [ ] **Step 2: Add command to `package.json`**

In `package.json`, find the `"contributes": { "commands": [ ... ] }` array and add:

```json
{
  "command": "cloudinary.configureAiTools",
  "title": "Configure AI Tools",
  "category": "Cloudinary"
}
```

- [ ] **Step 3: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/commands/registerCommands.ts package.json
git commit -m "feat: register cloudinary.configureAiTools command"
```

---

### Task 3: Wire up the homescreen button

**Files:**
- Modify: `src/webview/homescreenView.ts`
- Modify: `src/webview/client/homescreen.ts`

The "Configure AI Tools" button exists in the homescreen HTML but is disabled with no ID and shows a "Soon" chip. Enable it and wire up its click to trigger the command.

- [ ] **Step 1: Enable the button and add an ID in `homescreenView.ts`**

In `src/webview/homescreenView.ts`, find (around line 421):

```html
          <button class="hs-action" disabled aria-disabled="true">
            <span class="hs-action-icon hs-action-icon--violet" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.734 1.734 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.734 1.734 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.734 1.734 0 0 0 3.407 2.31l.387-1.162zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Configure AI Tools</span>
              <span class="hs-action-desc">MCP servers &amp; agent skills</span>
            </span>
            <span class="hs-chip" aria-label="Coming soon">Soon</span>
          </button>
```

Replace with:

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

- [ ] **Step 2: Add message handler in `homescreenView.ts`**

In `src/webview/homescreenView.ts`, inside `webviewView.webview.onDidReceiveMessage`, add a new case after the `openWelcomeScreen` case:

```typescript
          case "configureAiTools":
            vscode.commands.executeCommand("cloudinary.configureAiTools");
            break;
```

- [ ] **Step 3: Wire click listener in `homescreen.ts`**

In `src/webview/client/homescreen.ts`, inside the `DOMContentLoaded` listener, add:

```typescript
  document.getElementById("hs-btn-ai-tools")?.addEventListener("click", () => postMessage("configureAiTools"));
```

- [ ] **Step 4: Type-check and compile**

```bash
npm run compile
```

Expected: no errors, `dist/extension.js` updated.

- [ ] **Step 5: Manual smoke test**

Press `F5` to launch the Extension Development Host. Verify:

1. Homescreen shows "Configure AI Tools" button — enabled (no "Soon" chip, not greyed out).
2. Click the button → QuickPick appears with "Skills ✓" and "MCP Config ✓".
3. Select both, confirm → skill list QuickPick appears with all three Cloudinary skills checked.
4. Select all skills, confirm → IDE target QuickPick appears pre-selected based on detected editor.
5. Confirm → skills are written to the correct location (e.g. `.claude/skills/cloudinary-docs/SKILL.md`).
6. Success notification shows with "Open File" action.
7. Run command from Command Palette: `Cloudinary: Configure AI Tools` — same flow.

> **Note:** The `cloudinary-devs/skills` repo is currently private. For smoke testing, you will need a temporary `gh auth token` workaround or wait until the repo is public. The extension itself uses unauthenticated `fetch` which will work once the repo is public.

- [ ] **Step 6: Commit**

```bash
git add src/webview/homescreenView.ts src/webview/client/homescreen.ts
git commit -m "feat: enable Configure AI Tools homescreen button and wire up message handler"
```
