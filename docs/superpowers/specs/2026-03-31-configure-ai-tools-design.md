# Configure AI Tools — Design Spec

## Goal

Replace the existing `setupWorkspace` command with `configureAiTools`: a command that lets developers install Cloudinary agent skills from the `cloudinary-devs/skills` GitHub repo into their project, and configure MCP servers. Wired to the "Configure AI Tools" button already present (currently disabled) in the homescreen webview.

## Architecture

- **New file**: `src/commands/configureAiTools.ts` — replaces `src/commands/setupWorkspace.ts`
- **Update**: `src/commands/registerCommands.ts` — swap `registerSetupWorkspace` for `registerConfigureAiTools`
- **Update**: `package.json` — rename command ID from `cloudinary.setupWorkspace` to `cloudinary.configureAiTools`, update title to "Configure AI Tools"
- **Update**: `src/webview/homescreenView.ts` — handle `configureAiTools` message from webview
- **Update**: `src/webview/client/homescreen.ts` — enable the "Configure AI Tools" button, send `configureAiTools` message on click

## Command Flow

1. User clicks "Configure AI Tools" in the homescreen (or runs the command from the palette)
2. Require an open workspace folder; show error and return if none
3. Show multi-select QuickPick: `[Skills ✓, MCP Config ✓]`
4. If neither selected, return
5. If **Skills** selected → run skills flow (see below)
6. If **MCP Config** selected → run MCP config flow (see below)

## Skills Flow

### Fetching the skill list

Use unauthenticated `fetch` against the GitHub Contents API (no token required once the repo is public; during development access requires existing `gh` auth outside the extension):

```
GET https://api.github.com/repos/cloudinary-devs/skills/contents/skills
```

Returns an array of directory entries. For each entry with `type === "dir"`, fetch its `SKILL.md` in parallel:

```
GET https://api.github.com/repos/cloudinary-devs/skills/contents/skills/<name>/SKILL.md
```

The response contains `content` (base64-encoded). Decode and parse the YAML frontmatter to extract `name` and `description`.

### Picker

Show a `canPickMany: true` QuickPick. Each item:
- `label`: skill name (e.g. `cloudinary-docs`)
- `description`: description from SKILL.md frontmatter
- All items picked by default

### IDE target selection

After skill selection, ask which AI tool to install for (single-select QuickPick):

| Option | Install location |
|--------|-----------------|
| Claude Code | `.claude/skills/<name>/SKILL.md` + `.claude/skills/<name>/references/<file>` |
| Cursor | `.cursor/rules/<name>.mdc` |
| VS Code (Copilot) | `.github/copilot-instructions.md` |

### Downloading and writing files

**Claude Code**
- Write decoded `SKILL.md` content as-is to `.claude/skills/<name>/SKILL.md`
- Fetch `GET .../contents/skills/<name>/references` (ignore 404 — no references dir)
- For each file in references, fetch and write to `.claude/skills/<name>/references/<filename>`

**Cursor**
- Write a single `.cursor/rules/<name>.mdc` file
- Content: SKILL.md content with `name:` line removed from frontmatter (Cursor only uses `description:`)

**VS Code (Copilot)**
- Target file: `.github/copilot-instructions.md`
- Create if absent; append if present
- Append each selected skill as:
  ```
  ## <name>
  <skill body content — everything after frontmatter>
  ```
- Separate multiple appended skills with a blank line

### Overwrite handling

- Claude Code / Cursor: if the target file already exists, prompt "Overwrite?" before writing (same pattern as existing `setupWorkspace`)
- VS Code Copilot: always appends; no overwrite prompt needed

## MCP Config Flow

Carry forward the existing `createMCPConfig` logic from `setupWorkspace.ts` unchanged. Uses the same editor-detection (`detectEditor()`) and path mapping for `.cursor/mcp.json`, `.vscode/mcp.json`, etc.

## Success Feedback

After all selected operations complete, show an information message:
`✅ Configured AI tools: <comma-separated list of what was done>`

Offer an "Open File" action that opens the first written file.

## Error Handling

- No workspace open: `showErrorMessage("Please open a workspace folder first.")`
- Network failure fetching skill list: `showErrorMessage("Failed to fetch skills: <message>")`
- Network failure downloading a skill file: skip that file, collect errors, show a warning after completion listing which files failed

## File Map

| Action | File |
|--------|------|
| Create | `src/commands/configureAiTools.ts` |
| Delete | `src/commands/setupWorkspace.ts` |
| Modify | `src/commands/registerCommands.ts` |
| Modify | `package.json` |
| Modify | `src/webview/homescreenView.ts` |
| Modify | `src/webview/client/homescreen.ts` |
