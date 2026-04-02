# Configure AI Tools — Multi-Platform Redesign Spec

## Goal

Revise the accordion panel to support installing skills to multiple platforms simultaneously. Replace the single-select IDE tab control with a multi-select "Install for" platform checklist placed *below* the skills list. Add Universal (`.agents/skills/`) and Windsurf as install targets; retire the Cursor-specific `.cursor/rules/` path in favour of Universal.

---

## Platform Definitions

| ID | Display name | Skills path | Notes |
|----|-------------|-------------|-------|
| `universal` | Universal | `.agents/skills/{dirName}/SKILL.md` | Covers Cursor, Codex, Amp, Warp, Antigravity, Gemini CLI + more |
| `claude-code` | Claude Code | `.claude/skills/{dirName}/SKILL.md` | |
| `vscode-copilot` | VS Code (Copilot) | `.github/copilot-instructions.md` | Appends `## {name}` section |
| `windsurf` | Windsurf | `.windsurf/skills/{dirName}/SKILL.md` | |

Cursor's old `.cursor/rules/{dirName}.mdc` install path is **retired** from the webview flow. The QuickPick command palette fallback may keep it for now but the accordion uses Universal for Cursor users.

### Universal sub-label

The `universal` platform row shows a muted sub-label: **"Cursor, Codex, Amp, Warp + more"** to make it obvious that checking this covers Cursor-based workflows.

---

## Panel Layout (Ready state)

```
  Skills
  ────────────────────────────
  ☑  cloudinary-docs     installed
  ☑  cloudinary-react    partial
  ☑  cloudinary-transforms    —

  Install for
  ────────────────────────────
  ☑  Universal
     Cursor, Codex, Amp, Warp + more
  ☑  Claude Code
  ☐  VS Code (Copilot)
  ☐  Windsurf

  MCP Servers
  ────────────────────────────
  ☐  Asset Management  configured
  ☑  MediaFlows               —

  [ Apply ]
```

Skills checklist is above the platform selector. Platform selector is always visible (not collapsible).

---

## Skill Status Logic

Status is computed relative to the **currently checked platforms**:

| Condition | Label | Default checked? |
|-----------|-------|-----------------|
| Installed on **all** checked platforms | `installed` | No |
| Installed on **some** checked platforms | `partial` | Yes (fills the gaps) |
| Installed on **none** of the checked platforms | `—` | Yes |

Status label is recomputed live whenever the user toggles a platform checkbox. No round-trip to the extension needed — all `installedByPlatform` data is cached in the client from the initial `aiToolsData` message.

---

## Default Platform Selection

On accordion open, the extension computes `activePlatforms` — the set of platforms that should be pre-checked:

1. **Detected IDE** → mapped to platform ID:
   - `detectEditor()` returns `"unknown"` or `"cursor"` → `universal`
   - `"claude-code"` / `"antigravity"` → `claude-code` … wait, antigravity → `universal`
   - Full mapping: `cursor` → `universal`, `windsurf` → `windsurf`, `vscode` → `vscode-copilot`, everything else (claude-code, unknown, antigravity) → `claude-code` for claude-code, `universal` for others

   Simplified: `windsurf` → `windsurf`; `vscode` → `vscode-copilot`; `cursor` or `antigravity` → `universal`; default (claude-code, unknown) → `claude-code`.

2. **Already-installed platforms** → any platform where at least one skill dir is found on disk is also pre-checked (user has an existing setup there).

`activePlatforms` = union of detected-IDE platform + all platforms with existing installs.

---

## Data Flow

### Open accordion

Extension computes in parallel:
- `fetchSkillList()` (cached after first open)
- `readInstalledSkillDirNames(rootUri, platformId, skills)` for all 4 platforms
- `readActivePlatforms(rootUri)` — checks which platform dirs exist on disk
- `readConfiguredMcpServerKeys(rootUri, ...)`

Posts `aiToolsData`:

```json
{
  "command": "aiToolsData",
  "skills": [
    { "name": "cloudinary-docs", "dirName": "cloudinary-docs", "description": "..." }
  ],
  "installedByPlatform": {
    "universal":      ["cloudinary-docs"],
    "claude-code":    ["cloudinary-docs"],
    "vscode-copilot": [],
    "windsurf":       []
  },
  "activePlatforms": ["universal", "claude-code"],
  "mcpServers": [
    { "key": "cloudinary-asset-mgmt", "label": "Asset Management", "description": "..." }
  ],
  "configuredMcpKeys": ["cloudinary-asset-mgmt"]
}
```

Note: `detectedIde` is gone; replaced by `activePlatforms`.

### Apply

Webview posts:

```json
{
  "command": "installAiTools",
  "skills": ["cloudinary-react"],
  "platforms": ["universal", "claude-code"],
  "mcpServers": ["mediaflows"]
}
```

Extension installs each skill to each platform in sequence. Progress posted per skill (one event covers all platforms for that skill — error if any platform fails):

```json
{ "command": "aiToolsProgress", "item": "cloudinary-react", "status": "done" }
{ "command": "aiToolsProgress", "item": "mediaflows",       "status": "done" }
```

Final result:

```json
{ "command": "aiToolsResult", "errors": [] }
```

---

## New / Changed Service Functions (`src/aiToolsService.ts`)

### New types

```typescript
export type PlatformId = 'universal' | 'claude-code' | 'vscode-copilot' | 'windsurf';

export type PlatformDef = {
  id: PlatformId;
  label: string;
  sublabel?: string;
};
```

### New constant

```typescript
export const PLATFORMS: PlatformDef[] = [
  { id: 'universal',     label: 'Universal',        sublabel: 'Cursor, Codex, Amp, Warp + more' },
  { id: 'claude-code',   label: 'Claude Code' },
  { id: 'vscode-copilot', label: 'VS Code (Copilot)' },
  { id: 'windsurf',      label: 'Windsurf' },
];
```

### New install functions

`installForUniversal(rootUri, skillName, content, createdFiles, errors)` — writes SKILL.md to `.agents/skills/{skillName}/SKILL.md`.  Same structure as `installForClaudeCode` but with `.agents/skills/` prefix.

`installForWindsurf(rootUri, skillName, content, createdFiles, errors)` — writes SKILL.md to `.windsurf/skills/{skillName}/SKILL.md`. Same structure.

### Updated `readInstalledSkillDirNames`

Signature changes to accept `PlatformId` instead of `ideTargetLabel: string`:

```typescript
export async function readInstalledSkillDirNames(
  rootUri: vscode.Uri,
  platform: PlatformId,
  skills: SkillInfo[]
): Promise<Set<string>>
```

Routing:
- `universal` → stat `.agents/skills/{dirName}/SKILL.md`
- `claude-code` → stat `.claude/skills/{dirName}/SKILL.md`
- `vscode-copilot` → read `.github/copilot-instructions.md`, check for `## {name}` sections
- `windsurf` → stat `.windsurf/skills/{dirName}/SKILL.md`

### New `detectActivePlatforms`

```typescript
export async function detectActivePlatforms(
  rootUri: vscode.Uri
): Promise<PlatformId[]>
```

Checks for existence of each platform's skills directory (or instructions file). Returns IDs of platforms that have any install present. Used to pre-check platforms that have existing setups.

### `detectEditorPlatform`

```typescript
export function detectEditorPlatform(): PlatformId
```

Maps `detectEditor()` result to a `PlatformId`:
- `windsurf` → `windsurf`
- `vscode` → `vscode-copilot`
- `cursor` | `antigravity` → `universal`
- everything else (claude-code, unknown) → `claude-code`

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/aiToolsService.ts` | Add `PlatformId`, `PlatformDef`, `PLATFORMS`; add `installForUniversal`, `installForWindsurf`; update `readInstalledSkillDirNames` to use `PlatformId`; add `detectActivePlatforms`, `detectEditorPlatform` |
| Modify | `src/webview/homescreenView.ts` | Replace IDE segmented control HTML with platform checkbox section; update `_handleAiToolsExpanded` (new message shape); update `_handleInstallAiTools` (accepts `platforms[]`) |
| Modify | `src/webview/client/homescreen.ts` | Replace IDE selector UI with platform multi-select; update skill status logic; update Apply payload |

---

## Styling

- Platform section uses the same `.hs-ai-item` / `.hs-ai-cb` pattern as skills and MCP rows
- Sub-label ("Cursor, Codex, Amp…") uses `--vscode-descriptionForeground`, font-size ~9.5px, displayed on its own line below the platform name
- No segmented control / pill animation needed — plain checkboxes
- Platform section header uses `.hs-ai-section-head` pattern

---

## Out of Scope

- `installForCursor` (old `.cursor/rules/` path) is kept in `aiToolsService.ts` for the QuickPick command palette flow but is not used by the accordion
- No per-platform progress ticks in the done state (one tick per skill covers all platforms)
- No "install globally" (to `~/.claude/skills` etc.) — workspace-level only
