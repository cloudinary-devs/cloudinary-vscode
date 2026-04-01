# Configure AI Tools — Webview Panel Design Spec

## Goal

Replace the VS Code QuickPick flow for "Configure AI Tools" with an inline accordion panel that expands within the homescreen sidebar webview. Skills and MCP server configuration are presented as checklists in a single panel — no modal menus, no context switching.

---

## Interaction Model

The "Configure AI Tools" action row gains a chevron on the right. Clicking it toggles an accordion panel directly below the button. The rest of the homescreen (footer) is pushed down; the sidebar scrolls if needed.

### Accordion States

| State | Description |
|-------|-------------|
| **Loading** | Shown immediately on open. Extension fetches skill list from GitHub and reads workspace status in parallel, then posts `aiToolsData` to the webview. Spinner or skeleton rows. |
| **Ready** | Skills checklist + MCP servers checklist + Apply button visible. |
| **Applying** | Apply button becomes "Applying…" (disabled). Each row updates with ✓ or ✗ as it completes. |
| **Done** | All rows show final status. Accordion stays open so user can review results. |

---

## Panel Content

### Skills Sub-section

Header: `Skills`

A 3-button segmented control selects the IDE target:
- **Claude Code** (default unless `detectEditor()` returns `cursor` or `vscode`)
- **Cursor**
- **VS Code Copilot**

Pre-selected based on `detectEditor()`. User can change before clicking Apply.

Below the IDE selector, a flat checklist — one row per skill:

```
☑  cloudinary-docs            ✓ installed
☑  cloudinary-react            not installed
☑  cloudinary-transformations  not installed
```

- Checkbox always starts **checked** regardless of install status (overwrite prompt in the extension is the safety net for already-installed skills)
- Status label is small and muted, shown to the right of the skill name

### MCP Servers Sub-section

Header: `MCP Servers`

Same flat checklist pattern. Smart defaults: already-configured servers start **unchecked** to protect credentials from silent overwrite.

```
☐  Asset Management       ✓ configured
☑  MediaFlows             not configured
```

### Apply Button

Full-width button at the bottom of the accordion, labelled **"Apply"**.

- Disabled when no items are checked
- During apply: label becomes "Applying…", button disabled
- After apply: button label returns to "Apply" (panel stays open)

---

## Data Flow

### Open accordion

1. User clicks the "Configure AI Tools" row
2. Webview toggles accordion open, shows loading state
3. Webview posts `{ command: "aiToolsExpanded" }` to extension
4. Extension in parallel:
   - Fetches skill list from GitHub (`fetchSkillList()`)
   - Reads workspace status (`readInstalledSkillDirNames`, `readConfiguredMcpServerKeys`) for all three IDE targets
   - Detects editor (`detectEditor()`)
5. Extension posts to webview:
```json
{
  "command": "aiToolsData",
  "skills": [
    { "name": "cloudinary-docs", "dirName": "cloudinary-docs", "description": "..." }
  ],
  "installedByIde": {
    "Claude Code": ["cloudinary-docs"],
    "Cursor": [],
    "VS Code (Copilot)": []
  },
  "mcpServers": [
    { "key": "cloudinary-asset-mgmt", "label": "Asset Management", "description": "..." }
  ],
  "configuredMcpKeys": ["cloudinary-asset-mgmt"],
  "detectedIde": "Claude Code"
}
```
6. Webview renders the checklist from this data

### Apply

1. User clicks Apply
2. Webview posts:
```json
{
  "command": "installAiTools",
  "skills": ["cloudinary-react", "cloudinary-transformations"],
  "ideTarget": "Claude Code",
  "mcpServers": ["mediaflows"]
}
```
3. Extension processes each item, posting progress after each:
```json
{ "command": "aiToolsProgress", "item": "cloudinary-react", "status": "done" }
{ "command": "aiToolsProgress", "item": "mediaflows", "status": "done" }
```
4. Extension posts final result:
```json
{ "command": "aiToolsResult", "errors": [] }
```
5. Webview updates row statuses; shows error rows if any

### Error on skill fetch

If GitHub fetch fails, extension posts:
```json
{ "command": "aiToolsData", "error": "Failed to fetch skills: <message>" }
```
Webview shows the error inline in the accordion.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/webview/homescreenView.ts` | Add accordion HTML; handle `aiToolsExpanded` / `installAiTools` messages; send `aiToolsData` / `aiToolsProgress` / `aiToolsResult` |
| Modify | `src/webview/client/homescreen.ts` | Accordion toggle logic; render panel from `aiToolsData`; wire Apply; handle progress/result messages |
| Modify | `src/commands/configureAiTools.ts` | Extract `installSkill()` and `installMcpServers()` as exported functions; the `cloudinary.configureAiTools` command becomes a thin wrapper (or is removed if the button is the only entry point) |

---

## Styling Constraints

- Follow existing homescreen CSS patterns (`--vscode-*` CSS variables only, no hardcoded colours)
- Accordion panel uses the same `hs-action` row sizing and typography
- Segmented control uses existing button/border styles
- Checklist rows are compact: ~28–30px per row to fit within narrow sidebar
- Apply button matches `.hs-setup-banner-btn` style but full-width

---

## Out of Scope

- The `cloudinary.configureAiTools` VS Code command (palette entry) continues to exist as a thin wrapper calling the same install logic — no regression for keyboard users
- No animations on accordion open/close beyond CSS `max-height` transition (keep it simple)
- No per-section independent Apply buttons — one Apply commits everything
