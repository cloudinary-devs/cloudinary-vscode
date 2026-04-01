# Configure AI Tools v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch MCP server configs to remote OAuth URLs and add status annotations to every QuickPick so users see what's already installed when re-running the command.

**Architecture:** All changes are in `src/commands/configureAiTools.ts`. Three sequential tasks: (1) simplify `McpServerDef` and update server URLs, (2) add two status-detection helpers, (3) reorder the skills flow and wire status into both pickers.

**Tech Stack:** TypeScript, VS Code Extension API (`vscode.workspace.fs`, `vscode.window.showQuickPick`, `vscode.window.createQuickPick`)

---

### Task 1: Simplify McpServerDef and switch to remote OAuth URLs

**Files:**
- Modify: `src/commands/configureAiTools.ts:7-15` (type), `src/commands/configureAiTools.ts:312-430` (MCP_SERVERS + createMcpConfig)

The four Cloudinary LLM MCP servers now use remote OAuth endpoints — no credentials in the file. MediaFlows keeps its headers-based config. Since both editors now use the same server entry format (only the root key `"servers"` vs `"mcpServers"` differs), the `McpServerDef` type simplifies from two config fields to one.

- [ ] **Step 1: Replace the `McpServerDef` type**

In `src/commands/configureAiTools.ts`, replace lines 7–15:

```typescript
type McpServerDef = {
  label: string;
  description: string;
  key: string;
  config: Record<string, unknown>; // same for all editors; root key differs by editor
};
```

- [ ] **Step 2: Replace the entire `MCP_SERVERS` array**

Replace the `MCP_SERVERS` constant (currently lines 312–430) with:

```typescript
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
```

- [ ] **Step 3: Update `createMcpConfig` to use `def.config`**

Inside `createMcpConfig`, find the loop that writes server entries and change it from:
```typescript
servers[def.key] = isVscode ? def.vscodeConfig : def.cursorConfig;
```
to:
```typescript
servers[def.key] = def.config;
```

- [ ] **Step 4: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/commands/configureAiTools.ts
git commit -m "feat: switch MCP servers to remote OAuth URLs"
```

---

### Task 2: Add status-detection helpers

**Files:**
- Modify: `src/commands/configureAiTools.ts` — add two functions in the `// ── MCP Config` section, before `createMcpConfig`

- [ ] **Step 1: Add `readInstalledSkillDirNames`**

Insert this function immediately before the `// ── MCP Server definitions` comment:

```typescript
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
```

- [ ] **Step 2: Add `readConfiguredMcpServerKeys`**

Insert this function immediately after `readInstalledSkillDirNames`:

```typescript
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
```

- [ ] **Step 3: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/commands/configureAiTools.ts
git commit -m "feat: add skill and MCP status-detection helpers"
```

---

### Task 3: Reorder skills flow and annotate both QuickPicks

**Files:**
- Modify: `src/commands/configureAiTools.ts` — the skills block inside `registerConfigureAiTools` (currently lines ~507–573) and `createMcpConfig`

**Skills flow change:** IDE picker moves before the skills picker so `readInstalledSkillDirNames` can check the right paths before presenting the list.

**MCP flow change:** `createMcpConfig` calls `readConfiguredMcpServerKeys` before building its picker items.

- [ ] **Step 1: Replace the entire skills block inside `registerConfigureAiTools`**

Replace the block from `// ── Step 2: skills flow` through its closing `}` with:

```typescript
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
```

- [ ] **Step 2: Update `createMcpConfig` to annotate the server picker**

Replace the `showQuickPick` call and the `selectedDefs` derivation inside `createMcpConfig` with:

```typescript
async function createMcpConfig(
  rootUri: vscode.Uri,
  editor: EditorType,
  mcpFilePath: string,
  createdFiles: string[]
): Promise<void> {
  const isVscode = editor === "vscode";
  const rootKey = isVscode ? "servers" : "mcpServers";
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
```

- [ ] **Step 3: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 4: Run test suite**

```bash
npm run compile-tests && npm run test
```

Expected: `1 passing`

- [ ] **Step 5: Commit**

```bash
git add src/commands/configureAiTools.ts
git commit -m "feat: reorder skills flow and annotate QuickPicks with install status"
```
