# Configure AI Tools — Multi-Platform Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-select IDE segmented control in the AI Tools accordion with a multi-select platform checklist that supports installing skills to Universal (`.agents/skills/`), Claude Code (`.claude/skills/`), VS Code Copilot (`.github/copilot-instructions.md`), and Windsurf (`.windsurf/skills/`) simultaneously.

**Architecture:** The service layer (`aiToolsService.ts`) gains new typed platform concepts (`PlatformId`, `PlatformDef`, `PLATFORMS`), two new install functions (`installForUniversal`, `installForWindsurf`), and updated detection/status functions. The host-side webview provider (`homescreenView.ts`) is updated to build `installedByPlatform` for all 4 platforms and send `activePlatforms` instead of `detectedIde`. The client-side script (`homescreen.ts`) replaces the pill-animated IDE selector with platform checkboxes whose state drives live skill-status recomputation in the browser without any extension round-trip.

**Tech Stack:** TypeScript, VS Code Extension API (`vscode.workspace.fs`, `vscode.Uri`), esbuild (bundler), Mocha + `@vscode/test-electron` (tests run inside VS Code extension host)

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/aiToolsService.ts` | Add `PlatformId`, `PlatformDef`, `PLATFORMS`; add `installForUniversal`, `installForWindsurf`; rewrite `readInstalledSkillDirNames` to accept `PlatformId`; add `detectEditorPlatform`, `detectActivePlatforms` |
| Modify | `src/webview/homescreenView.ts` | Update imports; replace ready-state HTML (remove IDE segmented control, add platform checklist section); rewrite `_handleAiToolsExpanded` and `_handleInstallAiTools`; update `onDidReceiveMessage` type annotation |
| Modify | `src/webview/client/homescreen.ts` | Update `AiToolsDataMessage` interface; remove `_activeIde`, `movePill`, `initPill`; add `_activePlatforms`, `renderPlatformRows`, `computeSkillStatus`, `onPlatformChange`, `getCheckedPlatforms`; rewrite `renderSkillRows`, `updateApplyButton`, `handleApply`, `handleAiToolsData`, `init` |

---

## Task 1: Update `src/aiToolsService.ts`

**Files:**
- Modify: `src/aiToolsService.ts`

### Context

The current file uses string labels (`"Claude Code"`, `"Cursor"`, `"VS Code (Copilot)"`) to route install and status-detection logic. We are replacing those strings with a typed `PlatformId` union and adding two new install functions. The existing `installForCursor` and `installForCopilot` functions must be kept — `installForCursor` is still used by the QuickPick command palette flow, and `installForCopilot` is used by the updated `_handleInstallAiTools`.

- [ ] **Step 1: Add `PlatformId`, `PlatformDef`, and `PLATFORMS` after the existing type block**

Open `src/aiToolsService.ts`. After line 18 (the end of `SkillInfo` type, just before the `GitHubEntry` type), insert the following. The `GitHubEntry` type is private so the new exports go before it.

```typescript
export type PlatformId = 'universal' | 'claude-code' | 'vscode-copilot' | 'windsurf';

export type PlatformDef = {
  id: PlatformId;
  label: string;
  sublabel?: string;
};

export const PLATFORMS: PlatformDef[] = [
  { id: 'universal',      label: 'Universal',        sublabel: 'Cursor, Codex, Amp, Warp + more' },
  { id: 'claude-code',    label: 'Claude Code' },
  { id: 'vscode-copilot', label: 'VS Code (Copilot)' },
  { id: 'windsurf',       label: 'Windsurf' },
];
```

- [ ] **Step 2: Add `detectEditorPlatform` after the existing `getMcpFilePath` function**

`getMcpFilePath` ends around line 54. Add the new function directly after it:

```typescript
export function detectEditorPlatform(): PlatformId {
  const editor = detectEditor();
  if (editor === 'windsurf') { return 'windsurf'; }
  if (editor === 'vscode')   { return 'vscode-copilot'; }
  if (editor === 'cursor' || editor === 'antigravity') { return 'universal'; }
  return 'claude-code'; // claude-code, unknown
}
```

- [ ] **Step 3: Add `installForUniversal` after `installForCopilot`**

`installForCopilot` ends around line 296. Add after it:

```typescript
export async function installForUniversal(
  rootUri: vscode.Uri,
  skillName: string,
  skillContent: string,
  createdFiles: string[],
  errors: string[]
): Promise<void> {
  const skillFile = vscode.Uri.joinPath(rootUri, `.agents/skills/${skillName}/SKILL.md`);
  const written = await writeWithOverwriteCheck(skillFile, skillContent, `${skillName}/SKILL.md`);
  if (!written) { return; }
  createdFiles.push(`.agents/skills/${skillName}/SKILL.md`);

  let refs: Array<{ name: string; content: string }>;
  try { refs = await fetchReferenceFiles(skillName); } catch (err: any) {
    errors.push(`${skillName} references: ${err.message}`); return;
  }
  for (const ref of refs) {
    try {
      const refUri = vscode.Uri.joinPath(rootUri, `.agents/skills/${skillName}/references/${ref.name}`);
      await ensureDir(vscode.Uri.joinPath(refUri, '..'));
      await vscode.workspace.fs.writeFile(refUri, Buffer.from(ref.content, 'utf-8'));
      createdFiles.push(`.agents/skills/${skillName}/references/${ref.name}`);
    } catch (err: any) { errors.push(`${skillName}/references/${ref.name}: ${err.message}`); }
  }
}
```

- [ ] **Step 4: Add `installForWindsurf` after `installForUniversal`**

```typescript
export async function installForWindsurf(
  rootUri: vscode.Uri,
  skillName: string,
  skillContent: string,
  createdFiles: string[],
  errors: string[]
): Promise<void> {
  const skillFile = vscode.Uri.joinPath(rootUri, `.windsurf/skills/${skillName}/SKILL.md`);
  const written = await writeWithOverwriteCheck(skillFile, skillContent, `${skillName}/SKILL.md`);
  if (!written) { return; }
  createdFiles.push(`.windsurf/skills/${skillName}/SKILL.md`);

  let refs: Array<{ name: string; content: string }>;
  try { refs = await fetchReferenceFiles(skillName); } catch (err: any) {
    errors.push(`${skillName} references: ${err.message}`); return;
  }
  for (const ref of refs) {
    try {
      const refUri = vscode.Uri.joinPath(rootUri, `.windsurf/skills/${skillName}/references/${ref.name}`);
      await ensureDir(vscode.Uri.joinPath(refUri, '..'));
      await vscode.workspace.fs.writeFile(refUri, Buffer.from(ref.content, 'utf-8'));
      createdFiles.push(`.windsurf/skills/${skillName}/references/${ref.name}`);
    } catch (err: any) { errors.push(`${skillName}/references/${ref.name}: ${err.message}`); }
  }
}
```

- [ ] **Step 5: Replace `readInstalledSkillDirNames` with the `PlatformId`-based version**

The current function (around line 300–338) uses string labels. Replace the entire function body with:

```typescript
export async function readInstalledSkillDirNames(
  rootUri: vscode.Uri,
  platform: PlatformId,
  skills: SkillInfo[]
): Promise<Set<string>> {
  const installed = new Set<string>();

  if (platform === 'vscode-copilot') {
    try {
      const uri = vscode.Uri.joinPath(rootUri, '.github/copilot-instructions.md');
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(bytes).toString('utf-8');
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

  const pathPrefix =
    platform === 'claude-code' ? '.claude/skills' :
    platform === 'universal'   ? '.agents/skills' :
    /* windsurf */               '.windsurf/skills';

  await Promise.all(
    skills.map(async (skill) => {
      try {
        await vscode.workspace.fs.stat(
          vscode.Uri.joinPath(rootUri, `${pathPrefix}/${skill.dirName}/SKILL.md`)
        );
        installed.add(skill.dirName);
      } catch {
        // not installed
      }
    })
  );
  return installed;
}
```

- [ ] **Step 6: Add `detectActivePlatforms` after `readInstalledSkillDirNames`**

```typescript
export async function detectActivePlatforms(rootUri: vscode.Uri): Promise<PlatformId[]> {
  const checks: Array<{ id: PlatformId; path: string }> = [
    { id: 'universal',      path: '.agents/skills' },
    { id: 'claude-code',    path: '.claude/skills' },
    { id: 'vscode-copilot', path: '.github/copilot-instructions.md' },
    { id: 'windsurf',       path: '.windsurf/skills' },
  ];
  const active = new Set<PlatformId>([detectEditorPlatform()]);
  await Promise.all(
    checks.map(async ({ id, path }) => {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.joinPath(rootUri, path));
        active.add(id);
      } catch { /* not present */ }
    })
  );
  return [...active];
}
```

- [ ] **Step 7: Run type check**

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run check-types
```

Expected: zero errors. If you see errors about `readInstalledSkillDirNames` being called with string labels elsewhere in the codebase, those will be fixed in Task 2 — for now the only callers are in `homescreenView.ts`.

- [ ] **Step 8: Commit**

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && git add src/aiToolsService.ts && git commit -m "feat: add PlatformId types, installForUniversal/Windsurf, detectActivePlatforms"
```

---

## Task 2: Update `src/webview/homescreenView.ts`

**Files:**
- Modify: `src/webview/homescreenView.ts`

### Context

This file generates the webview HTML as a template string inside `_getBodyContent()` and handles messages from the webview in `onDidReceiveMessage`. Three things need updating:

1. The import line — add the new service functions exported in Task 1.
2. The HTML template — replace the IDE segmented control block and its CSS with a platform checklist section.
3. `_handleAiToolsExpanded` — build `installedByPlatform` for all 4 platform IDs and call `detectActivePlatforms`.
4. `_handleInstallAiTools` — accept `platforms: string[]` instead of `ideTarget: string`.
5. The `onDidReceiveMessage` type annotation — update to reflect the new message shape.

- [ ] **Step 1: Update the import from `../aiToolsService`**

Current import block (lines 11–23):

```typescript
import {
  SkillInfo,
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

Replace with:

```typescript
import {
  PlatformId,
  SkillInfo,
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
  installForUniversal,
  installForWindsurf,
  installMcpServers,
  detectActivePlatforms,
  detectEditorPlatform,
} from "../aiToolsService";
```

Note: `installForCursor` is kept because it is still imported (even though the accordion no longer uses it, removing it would be a separate cleanup). If TypeScript warns about an unused import later, that is acceptable — but do not remove it in this task as it is used by other command files that import from this module. Actually, `installForCursor` is only called inside `homescreenView.ts`; after Task 2 it will be unused here. Remove it from this import line to avoid lint warnings:

Final import list:

```typescript
import {
  PlatformId,
  SkillInfo,
  MCP_SERVERS,
  detectEditor,
  getMcpFilePath,
  fetchSkillList,
  fetchSkillContent,
  readInstalledSkillDirNames,
  readConfiguredMcpServerKeys,
  installForClaudeCode,
  installForCopilot,
  installForUniversal,
  installForWindsurf,
  installMcpServers,
  detectActivePlatforms,
} from "../aiToolsService";
```

`detectEditorPlatform` is not needed directly in `homescreenView.ts` because `detectActivePlatforms` calls it internally.

- [ ] **Step 2: Remove the IDE segmented control CSS block**

In `_getBodyContent()`, locate and delete the entire CSS block that styles `.hs-ai-ide`, `.hs-ai-ide-pill`, and `.hs-ai-ide-btn` (lines ~464–506 in the original). These classes are being removed from the HTML in Step 3.

The block to remove is:

```css
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
```

- [ ] **Step 3: Add CSS for `.hs-ai-platform-sub` and `.hs-ai-item-status--partial`**

In the `<style>` block, after the `.hs-ai-item-status--none::before` rule (which currently ends the status indicator section), add:

```css
        .hs-ai-item-status--partial::before { background: rgba(250,204,21,0.7); }
        .hs-ai-platform-sub {
          display: block;
          font-size: 9px;
          font-weight: 400;
          color: var(--vscode-descriptionForeground);
          margin-top: 1px;
        }
```

- [ ] **Step 4: Replace the ready-state HTML**

Locate the `<!-- Ready / applying state -->` comment and the `<div>` with `id="hs-ai-state-ready"`. The current content is:

```html
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
```

Replace with:

```html
            <!-- Ready / applying state -->
            <div class="hs-ai-panel-inner hidden" id="hs-ai-state-ready">
              <div>
                <div class="hs-ai-section-head">Skills</div>
                <div id="hs-ai-skills-list"></div>
                <div class="hs-ai-section-head" style="margin-top:8px">Install for</div>
                <div id="hs-ai-platform-list"></div>
              </div>
              <div>
                <div class="hs-ai-section-head">MCP Servers</div>
                <div id="hs-ai-mcp-list"></div>
              </div>
              <button class="hs-ai-apply" id="hs-ai-apply" disabled>Apply</button>
            </div>
```

- [ ] **Step 5: Replace `_handleAiToolsExpanded`**

The current method (lines ~780–837) uses `ideLabels` string array and `detectedIde`. Replace the entire method:

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
      if (!this._cachedSkills) {
        this._cachedSkills = await fetchSkillList();
      }
      const skills = this._cachedSkills;

      const platformIds: PlatformId[] = ["universal", "claude-code", "vscode-copilot", "windsurf"];
      const installedByPlatform: Record<string, string[]> = {};
      await Promise.all(
        platformIds.map(async (pid) => {
          const set = await readInstalledSkillDirNames(rootUri, pid, skills);
          installedByPlatform[pid] = [...set];
        })
      );

      const activePlatforms = await detectActivePlatforms(rootUri);

      const editor = detectEditor();
      const mcpFilePath = getMcpFilePath(editor);
      const rootKey = editor === "vscode" ? "servers" : "mcpServers";
      const configuredMcpSet = await readConfiguredMcpServerKeys(rootUri, mcpFilePath, rootKey);

      view.webview.postMessage({
        command: "aiToolsData",
        skills: skills.map((s) => ({ name: s.name, description: s.description, dirName: s.dirName })),
        installedByPlatform,
        activePlatforms,
        mcpServers: MCP_SERVERS.map((s) => ({ key: s.key, label: s.label, description: s.description })),
        configuredMcpKeys: [...configuredMcpSet],
      });
    } catch (err: any) {
      view.webview.postMessage({
        command: "aiToolsData",
        error: err.message ?? String(err),
      });
    }
  }
```

- [ ] **Step 6: Replace `_handleInstallAiTools`**

Current method signature is `(skills, ideTarget, mcpServers)`. Replace the entire method:

```typescript
  private async _handleInstallAiTools(
    skills: string[],
    platforms: string[],
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
    const cachedSkills = this._cachedSkills ?? [];

    for (const dirName of skills) {
      const skillInfo = cachedSkills.find((s) => s.dirName === dirName);
      if (!skillInfo) { continue; }

      let content: string;
      try {
        content = await fetchSkillContent(dirName);
      } catch (err: any) {
        errors.push(`${dirName}: ${err.message}`);
        view.webview.postMessage({ command: "aiToolsProgress", item: dirName, status: "error" });
        continue;
      }

      const createdFiles: string[] = [];
      let anyError = false;
      for (const platform of platforms) {
        try {
          if (platform === "claude-code") {
            await installForClaudeCode(rootUri, dirName, content, createdFiles, errors);
          } else if (platform === "universal") {
            await installForUniversal(rootUri, dirName, content, createdFiles, errors);
          } else if (platform === "windsurf") {
            await installForWindsurf(rootUri, dirName, content, createdFiles, errors);
          } else if (platform === "vscode-copilot") {
            await installForCopilot(rootUri, skillInfo.name, content, createdFiles);
          }
        } catch (err: any) {
          errors.push(`${dirName} (${platform}): ${err.message}`);
          anyError = true;
        }
      }
      view.webview.postMessage({
        command: "aiToolsProgress",
        item: dirName,
        status: anyError ? "error" : "done",
      });
    }

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

    this._cachedSkills = undefined;
    view.webview.postMessage({ command: "aiToolsResult", errors });
  }
```

- [ ] **Step 7: Update the `onDidReceiveMessage` type annotation and `installAiTools` case**

Current type annotation on line 67:

```typescript
async (message: { command: string; skills?: string[]; ideTarget?: string; mcpServers?: string[] }) => {
```

Replace with:

```typescript
async (message: { command: string; skills?: string[]; platforms?: string[]; mcpServers?: string[] }) => {
```

Current `installAiTools` case (lines 84–90):

```typescript
          case "installAiTools":
            await this._handleInstallAiTools(
              message.skills ?? [],
              message.ideTarget ?? "Claude Code",
              message.mcpServers ?? []
            );
            break;
```

Replace with:

```typescript
          case "installAiTools":
            await this._handleInstallAiTools(
              message.skills ?? [],
              message.platforms ?? [],
              message.mcpServers ?? []
            );
            break;
```

- [ ] **Step 8: Run type check**

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run check-types
```

Expected: zero errors. The previous `readInstalledSkillDirNames` calls with string labels are now gone; the new calls pass `PlatformId` values.

- [ ] **Step 9: Commit**

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && git add src/webview/homescreenView.ts && git commit -m "feat: replace IDE segmented control with platform checklist in homescreen webview"
```

---

## Task 3: Update `src/webview/client/homescreen.ts`

**Files:**
- Modify: `src/webview/client/homescreen.ts`

### Context

This file runs inside the sandboxed webview (no access to Node or VS Code APIs). It communicates with the extension host only via `postMessage` / `window.addEventListener("message", ...)`. All changes here are pure browser TypeScript. The compiled output goes to `media/scripts/homescreen.js` via esbuild.

Key concepts:
- `_cachedData` holds the full `AiToolsDataMessage` payload received on accordion open. Skill status is recomputed from this cache whenever platform checkboxes change — no extension round-trip needed.
- `_activePlatforms` is no longer needed as separate state because the checked state lives in the DOM checkboxes; `getCheckedPlatforms()` reads them on demand.
- `movePill` and `initPill` are deleted along with the `_activeIde` variable.

- [ ] **Step 1: Update the `AiToolsDataMessage` interface and `_cachedData` type**

Replace:

```typescript
interface AiToolsDataMessage {
  command: "aiToolsData";
  skills: SkillInfo[];
  installedByIde: Record<string, string[]>; // ideLabel → array of dirNames
  mcpServers: McpServerInfo[];
  configuredMcpKeys: string[];
  detectedIde: string;
  error?: string;
}
```

With:

```typescript
interface AiToolsDataMessage {
  command: "aiToolsData";
  skills: SkillInfo[];
  installedByPlatform: Record<string, string[]>; // platformId → array of dirNames
  activePlatforms: string[];
  mcpServers: McpServerInfo[];
  configuredMcpKeys: string[];
  error?: string;
}
```

Also update the `_cachedData` declaration in the module state section. Replace:

```typescript
let _cachedData: Omit<AiToolsDataMessage, "command"> | null = null;
let _activeIde = "Claude Code";
```

With:

```typescript
let _cachedData: Omit<AiToolsDataMessage, "command"> | null = null;
```

- [ ] **Step 2: Delete `movePill` and `initPill`**

Remove the entire `// ── IDE pill ──` section (lines ~82–92):

```typescript
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
```

- [ ] **Step 3: Add `PLATFORM_DEFS` constant and `renderPlatformRows` function**

Add after the `renderSkillRows` function (which we will rewrite in the next step). Insert:

```typescript
const PLATFORM_DEFS = [
  { id: 'universal',      label: 'Universal',        sublabel: 'Cursor, Codex, Amp, Warp + more' },
  { id: 'claude-code',    label: 'Claude Code' },
  { id: 'vscode-copilot', label: 'VS Code (Copilot)' },
  { id: 'windsurf',       label: 'Windsurf' },
];

function renderPlatformRows(activePlatforms: string[]): void {
  const list = el('hs-ai-platform-list');
  if (!list) { return; }
  const activeSet = new Set(activePlatforms);
  list.innerHTML = PLATFORM_DEFS.map((p) => {
    const checked = activeSet.has(p.id) ? 'checked' : '';
    const sublabel = p.sublabel
      ? `<span class="hs-ai-platform-sub">${escapeHtml(p.sublabel)}</span>`
      : '';
    return `<label class="hs-ai-item hs-ai-platform-row">
      <input type="checkbox" class="hs-ai-cb hs-ai-platform-cb" data-platform="${escapeHtml(p.id)}" ${checked}>
      <span class="hs-ai-item-name">${escapeHtml(p.label)}${sublabel}</span>
    </label>`;
  }).join('');
  list.querySelectorAll<HTMLInputElement>('.hs-ai-platform-cb').forEach((cb) => {
    cb.addEventListener('change', onPlatformChange);
  });
}
```

- [ ] **Step 4: Add `computeSkillStatus` and `getCheckedPlatforms` helper functions**

Add these before `renderPlatformRows`:

```typescript
function getCheckedPlatforms(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>('.hs-ai-platform-cb')]
    .filter((c) => c.checked)
    .map((c) => c.dataset.platform!);
}

function computeSkillStatus(
  dirName: string,
  installedByPlatform: Record<string, string[]>,
  checkedPlatforms: string[]
): 'installed' | 'partial' | 'none' {
  if (checkedPlatforms.length === 0) { return 'none'; }
  const installedCount = checkedPlatforms.filter(
    (pid) => (installedByPlatform[pid] ?? []).includes(dirName)
  ).length;
  if (installedCount === checkedPlatforms.length) { return 'installed'; }
  if (installedCount > 0) { return 'partial'; }
  return 'none';
}
```

- [ ] **Step 5: Rewrite `renderSkillRows`**

Replace the current `renderSkillRows` (which takes `installedDirNames: string[]`) with the new signature that takes `installedByPlatform` and `checkedPlatforms`:

```typescript
function renderSkillRows(
  skills: SkillInfo[],
  installedByPlatform: Record<string, string[]>,
  checkedPlatforms: string[]
): void {
  const list = el('hs-ai-skills-list');
  if (!list) { return; }
  list.innerHTML = skills.map((s) => {
    const status = computeSkillStatus(s.dirName, installedByPlatform, checkedPlatforms);
    const statusClass = status === 'installed' ? 'hs-ai-item-status--ok'
                      : status === 'partial'   ? 'hs-ai-item-status--partial'
                      : 'hs-ai-item-status--none';
    const statusText = status === 'installed' ? 'installed'
                     : status === 'partial'   ? 'partial'
                     : '—';
    const checked = status !== 'installed' ? 'checked' : '';
    return `<label class="hs-ai-item">
      <input type="checkbox" class="hs-ai-cb" data-skill="${escapeHtml(s.dirName)}" ${checked}>
      <span class="hs-ai-item-name" title="${escapeHtml(s.description)}">${escapeHtml(s.name)}</span>
      <span class="hs-ai-item-status ${statusClass}">${statusText}</span>
    </label>`;
  }).join('');
  list.querySelectorAll<HTMLInputElement>('.hs-ai-cb').forEach((cb) => {
    cb.addEventListener('change', updateApplyButton);
  });
}
```

- [ ] **Step 6: Add `onPlatformChange` handler**

Add after `renderPlatformRows`:

```typescript
function onPlatformChange(): void {
  if (!_cachedData) { return; }
  const checkedPlatforms = getCheckedPlatforms();
  renderSkillRows(_cachedData.skills, _cachedData.installedByPlatform, checkedPlatforms);
  updateApplyButton();
}
```

- [ ] **Step 7: Update `updateApplyButton`**

Replace:

```typescript
function updateApplyButton(): void {
  const applyBtn = el<HTMLButtonElement>("hs-ai-apply");
  if (!applyBtn) { return; }
  const anyChecked = [...document.querySelectorAll<HTMLInputElement>(".hs-ai-cb")]
    .some((c) => c.checked && !c.disabled);
  applyBtn.disabled = !anyChecked;
}
```

With:

```typescript
function updateApplyButton(): void {
  const applyBtn = el<HTMLButtonElement>('hs-ai-apply');
  if (!applyBtn) { return; }
  const anyItemChecked = [...document.querySelectorAll<HTMLInputElement>('.hs-ai-cb[data-skill], .hs-ai-cb[data-mcp]')]
    .some((c) => c.checked && !c.disabled);
  const anyPlatformChecked = getCheckedPlatforms().length > 0;
  applyBtn.disabled = !(anyItemChecked && anyPlatformChecked);
}
```

- [ ] **Step 8: Update `handleApply`**

Replace:

```typescript
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
```

With:

```typescript
function handleApply(): void {
  if (!_cachedData) { return; }

  const skillCheckboxes = document.querySelectorAll<HTMLInputElement>('.hs-ai-cb[data-skill]');
  const mcpCheckboxes = document.querySelectorAll<HTMLInputElement>('.hs-ai-cb[data-mcp]');

  const selectedSkills = [...skillCheckboxes].filter((c) => c.checked).map((c) => c.dataset.skill!);
  const selectedMcpKeys = [...mcpCheckboxes].filter((c) => c.checked).map((c) => c.dataset.mcp!);
  const selectedPlatforms = getCheckedPlatforms();

  document.querySelectorAll<HTMLInputElement>('.hs-ai-cb').forEach((c) => { c.disabled = true; });
  const applyBtn = el<HTMLButtonElement>('hs-ai-apply');
  if (applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Applying…';
  }

  getVSCode()?.postMessage({
    command: 'installAiTools',
    skills: selectedSkills,
    platforms: selectedPlatforms,
    mcpServers: selectedMcpKeys,
  });
}
```

- [ ] **Step 9: Update `handleAiToolsData`**

Replace the entire function:

```typescript
function handleAiToolsData(msg: AiToolsDataMessage): void {
  if (msg.error) {
    const errEl = el('hs-ai-error-msg');
    if (errEl) { errEl.textContent = msg.error; }
    showPanelState('error');
    return;
  }

  _cachedData = {
    skills: msg.skills,
    installedByPlatform: msg.installedByPlatform,
    activePlatforms: msg.activePlatforms,
    mcpServers: msg.mcpServers,
    configuredMcpKeys: msg.configuredMcpKeys,
  };

  const checkedPlatforms = msg.activePlatforms;
  renderPlatformRows(checkedPlatforms);
  renderSkillRows(msg.skills, msg.installedByPlatform, checkedPlatforms);
  renderMcpRows(msg.mcpServers, msg.configuredMcpKeys);
  showPanelState('ready');
  updateApplyButton();
}
```

- [ ] **Step 10: Update `toggleAccordion` — remove `initPill` call**

The current `toggleAccordion` function has two references to `initPill`:

1. A `transitionend` listener that calls `initPill()` after accordion open.
2. `requestAnimationFrame(() => { initPill(); })` in `handleAiToolsData`.

In `toggleAccordion`, remove the block:

```typescript
  if (_isOpen) {
    // Re-position pill after layout settles (accordion may have just opened)
    panel.addEventListener("transitionend", () => {
      initPill();
    }, { once: true });
  }
```

The `requestAnimationFrame(() => { initPill(); })` call was in `handleAiToolsData` (old version) — since we rewrote that function in Step 9, it is already gone.

- [ ] **Step 11: Update `init` — remove IDE selector listener block**

In `init()`, remove the following block entirely:

```typescript
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
```

No replacement is needed here — platform checkbox listeners are attached dynamically inside `renderPlatformRows`.

- [ ] **Step 12: Run type check**

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run check-types
```

Expected: zero errors.

- [ ] **Step 13: Compile and run tests**

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run compile-tests && npm run test
```

Expected: all tests pass. The test suite runs inside the VS Code extension host via `@vscode/test-electron`. If tests fail due to the new `readInstalledSkillDirNames` signature, check that the test stubs are passing `PlatformId` strings (`'claude-code'`, `'universal'`, etc.) rather than the old label strings (`"Claude Code"`, `"Cursor"`).

- [ ] **Step 14: Compile the full extension and verify the bundle**

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && npm run compile
```

Expected: `dist/extension.js` and `media/scripts/homescreen.js` are rebuilt with no errors.

- [ ] **Step 15: Commit**

```bash
cd /Users/nickbradley/dev/cloudinary-vscode && git add src/webview/client/homescreen.ts && git commit -m "feat: replace IDE selector with multi-platform checklist in homescreen client"
```

---

## Spec Coverage Verification

| Spec requirement | Task | Step |
|-----------------|------|------|
| `PlatformId` type union | Task 1 | Step 1 |
| `PlatformDef` type | Task 1 | Step 1 |
| `PLATFORMS` constant with sublabel for universal | Task 1 | Step 1 |
| `detectEditorPlatform()` mapping | Task 1 | Step 2 |
| `installForUniversal` writes to `.agents/skills/` | Task 1 | Step 3 |
| `installForWindsurf` writes to `.windsurf/skills/` | Task 1 | Step 4 |
| `readInstalledSkillDirNames` accepts `PlatformId` | Task 1 | Step 5 |
| `detectActivePlatforms` = IDE platform + existing installs | Task 1 | Step 6 |
| Remove IDE segmented control HTML and CSS | Task 2 | Steps 2, 4 |
| Add platform checklist HTML section below skills | Task 2 | Step 4 |
| `_handleAiToolsExpanded` sends `installedByPlatform` + `activePlatforms` | Task 2 | Step 5 |
| `_handleInstallAiTools` accepts `platforms[]`, installs to each | Task 2 | Step 6 |
| `AiToolsDataMessage` uses `installedByPlatform`, `activePlatforms` | Task 3 | Step 1 |
| `renderPlatformRows` renders 4 checkboxes with sublabel for universal | Task 3 | Step 3 |
| `computeSkillStatus` returns `installed`/`partial`/`none` | Task 3 | Step 4 |
| `renderSkillRows` uses platform-aware status | Task 3 | Step 5 |
| Platform checkbox change re-renders skill rows live | Task 3 | Step 6 |
| `updateApplyButton` requires at least one platform checked | Task 3 | Step 7 |
| `handleApply` sends `platforms` not `ideTarget` | Task 3 | Step 8 |
| `handleAiToolsData` initialises platform checkboxes from `activePlatforms` | Task 3 | Step 9 |
| `.hs-ai-item-status--partial` CSS | Task 2 | Step 3 |
| `.hs-ai-platform-sub` CSS | Task 2 | Step 3 |
| `installForCursor` kept for QuickPick flow (not removed) | Task 1 | — (not touched) |
