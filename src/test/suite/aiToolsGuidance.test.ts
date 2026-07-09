import * as assert from "assert";
import { buildAiToolsNextStepsMessage } from "../../utils/aiToolsGuidance";

suite("buildAiToolsNextStepsMessage", () => {
  test("nothing installed → null (no message)", () => {
    assert.strictEqual(buildAiToolsNextStepsMessage(0, 0), null);
  });

  test("skills only → no reload guidance", () => {
    assert.strictEqual(
      buildAiToolsNextStepsMessage(2, 0),
      "Cloudinary: installed 2 skills."
    );
  });

  test("single skill is singular", () => {
    assert.strictEqual(
      buildAiToolsNextStepsMessage(1, 0),
      "Cloudinary: installed 1 skill."
    );
  });

  test("MCP install includes reload/verify guidance with editor name", () => {
    const msg = buildAiToolsNextStepsMessage(0, 1, "Claude Code");
    assert.ok(msg);
    assert.ok(msg!.startsWith("Cloudinary: installed 1 MCP server."));
    assert.ok(msg!.includes("Reload Claude Code"));
    assert.ok(msg!.includes("configured but inactive"));
  });

  test("skills + MCP combine, plural MCP", () => {
    const msg = buildAiToolsNextStepsMessage(3, 2, "Cursor");
    assert.ok(msg!.startsWith("Cloudinary: installed 3 skills and 2 MCP servers."));
    assert.ok(msg!.includes("MCP servers connect"));
  });

  test("falls back to 'your editor' when label missing", () => {
    const msg = buildAiToolsNextStepsMessage(0, 1);
    assert.ok(msg!.includes("Reload your editor"));
  });
});
