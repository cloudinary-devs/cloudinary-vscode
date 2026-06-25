/**
 * Builds the post-install guidance message shown after "Configure AI Tools"
 * applies. Returns null when nothing was installed.
 *
 * MCP servers only take effect after the editor reloads; without spelling that
 * out, users see them as "configured" but not connected in their AI tool, so the
 * message includes an explicit reload/verify step whenever an MCP server landed.
 */
export function buildAiToolsNextStepsMessage(
  installedSkillsCount: number,
  installedMcpCount: number,
  mcpEditorLabel?: string
): string | null {
  if (installedSkillsCount <= 0 && installedMcpCount <= 0) {
    return null;
  }

  const parts: string[] = [];
  if (installedSkillsCount > 0) {
    parts.push(`${installedSkillsCount} skill${installedSkillsCount === 1 ? "" : "s"}`);
  }
  if (installedMcpCount > 0) {
    parts.push(`${installedMcpCount} MCP server${installedMcpCount === 1 ? "" : "s"}`);
  }
  const what = parts.join(" and ");

  const editorName = mcpEditorLabel ?? "your editor";
  const nextStep =
    installedMcpCount > 0
      ? ` Reload ${editorName} (Developer: Reload Window) and start a new chat so the MCP server${
          installedMcpCount === 1 ? "" : "s"
        } connect — until then they show as configured but inactive.`
      : "";

  return `Cloudinary: installed ${what}.${nextStep}`;
}
