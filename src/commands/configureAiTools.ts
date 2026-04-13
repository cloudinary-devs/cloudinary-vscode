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
  getPlatformEntry,
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

        const platformForStatus: Record<string, string | undefined> = {
          "Claude Code": "claude-code",
          "VS Code (Copilot)": "vscode-copilot",
        };
        const pid = platformForStatus[ideTarget.label];
        const platformEntry = pid ? getPlatformEntry(pid) : undefined;
        const installedResult = platformEntry
          ? await readInstalledSkillDirNames(rootUri, platformEntry, skills)
          : { project: new Set<string>(), global: new Set<string>() };
        const installedDirNames = installedResult.project;

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
