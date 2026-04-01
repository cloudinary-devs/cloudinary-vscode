# Configure AI Tools v2 — Design Spec

## Goal

Two improvements to the existing `configureAiTools` command:

1. Switch MCP server configs from local `npx` processes to remote OAuth URLs (MediaFlows keeps headers-based auth).
2. Add status annotations to every QuickPick so users can see what's already installed and make informed choices on re-entry.

## Changes to `src/commands/configureAiTools.ts` only

No other files need modification.

---

## Remote MCP Server Configs

Replace all `cursorConfig` / `vscodeConfig` entries for the four Cloudinary LLM MCP servers with remote URL entries. Both formats are identical — no `type` field needed since editors infer remote from the presence of `url`.

| Server | URL |
|--------|-----|
| cloudinary-asset-mgmt | `https://asset-management.mcp.cloudinary.com/mcp` |
| cloudinary-env-config | `https://environment-config.mcp.cloudinary.com/mcp` |
| cloudinary-smd | `https://structured-metadata.mcp.cloudinary.com/mcp` |
| cloudinary-analysis | `https://analysis.mcp.cloudinary.com/sse` |

These use OAuth — no credentials in the config file.

MediaFlows keeps the headers-based format unchanged (it does not use OAuth):

```json
{
  "url": "https://mediaflows.mcp.cloudinary.com/v2/mcp",
  "headers": {
    "cld-cloud-name": "your_cloud_name",
    "cld-api-key": "your_api_key",
    "cld-secret": "your_api_secret"
  }
}
```

The VS Code (`"servers"`) vs Cursor/others (`"mcpServers"`) root key distinction is unchanged.

---

## Flow Reorder: IDE Picker Before Skills Picker

The IDE target QuickPick moves **before** the skills picker. This is required so the correct install path is known when checking what's already installed.

New skills flow order:
1. IDE target picker (single-select, pre-selected via `detectEditor()`)
2. Skills picker (multi-select, annotated with install status for the selected IDE)

---

## Status Annotations

### Two new helpers

**`readInstalledSkillDirNames(rootUri, ideTarget)`** → `Set<string>`

Checks which skill `dirName` values are already present for the given IDE:
- Claude Code: `.claude/skills/<dirName>/SKILL.md` exists
- Cursor: `.cursor/rules/<dirName>.mdc` exists
- VS Code Copilot: `.github/copilot-instructions.md` contains `## <skillName>` (use the frontmatter `name`, not dirName)

Returns a Set of the dirNames (or skill names for Copilot) that are installed.

**`readConfiguredMcpServerKeys(rootUri, mcpFilePath, rootKey)`** → `Set<string>`

Reads the existing MCP config file, parses JSON, returns the keys present under `rootKey` (`"servers"` or `"mcpServers"`). Returns empty Set if the file doesn't exist or can't be parsed.

### Skills QuickPick annotations

After calling `readInstalledSkillDirNames`, build each QuickPick item:

```
label:       skill.name
description: skill.description
detail:      "✓ installed"  OR  "Not installed"
picked:      true  (always — user decides whether to re-install)
```

### MCP servers QuickPick annotations

After calling `readConfiguredMcpServerKeys`, build each QuickPick item:

```
label:       server.label
description: server.description
detail:      "✓ already configured"  OR  "Not configured"
picked:      false if already configured, true if not configured
```

Already-configured MCP servers default to **unchecked** to protect credentials (especially MediaFlows placeholder values) from silent overwrite on re-run. Status is still visible so the user knows what's there.

---

## Error Handling

No changes to existing error handling. `readInstalledSkillDirNames` and `readConfiguredMcpServerKeys` swallow errors silently (treat as "not installed/configured") — failure to read status is non-fatal.
