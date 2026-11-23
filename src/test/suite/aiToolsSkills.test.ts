import * as assert from "assert";
import { fetchSkillList, fetchSkillContent, fetchReferenceFiles } from "../../aiToolsService";

const BASE = "https://api.github.com/repos/cloudinary-devs/skills/contents";

function file(text: string) {
  return { content: Buffer.from(text, "utf-8").toString("base64"), encoding: "base64" };
}

function skillMd(name: string, description: string) {
  return file(`---\nname: ${name}\ndescription: ${description}\n---\n\nBody of ${name}`);
}

// The skills repo as it is laid out today: skills in category folders, plus
// one legacy skill directly under skills/ to show both layouts are read.
const repo: Record<string, unknown> = {
  [`${BASE}/skills`]: [
    { name: "platform", type: "dir" },
    { name: "frameworks", type: "dir" },
    { name: "legacy-skill", type: "dir" },
    { name: "README.md", type: "file" },
  ],
  [`${BASE}/skills/platform`]: [
    { name: "cloudinary-docs", type: "dir" },
    { name: "cloudinary-video", type: "dir" },
  ],
  [`${BASE}/skills/frameworks`]: [{ name: "cloudinary-react", type: "dir" }],
  [`${BASE}/skills/legacy-skill`]: [{ name: "SKILL.md", type: "file" }],
  [`${BASE}/skills/platform/cloudinary-docs/SKILL.md`]: skillMd("cloudinary-docs", "Docs"),
  [`${BASE}/skills/platform/cloudinary-video/SKILL.md`]: skillMd("cloudinary-video", "Video"),
  [`${BASE}/skills/frameworks/cloudinary-react/SKILL.md`]: skillMd("cloudinary-react", "React"),
  [`${BASE}/skills/legacy-skill/SKILL.md`]: skillMd("legacy-skill", "Legacy"),
  [`${BASE}/skills/platform/cloudinary-video/references`]: [
    { name: "player.md", type: "file" },
  ],
  [`${BASE}/skills/platform/cloudinary-video/references/player.md`]: file("Player notes"),
};

suite("Skill fetching from the skills repo", () => {
  const realFetch = globalThis.fetch;
  const requested: string[] = [];

  suiteSetup(() => {
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      requested.push(url);
      if (url in repo) {
        return new Response(JSON.stringify(repo[url]), { status: 200 });
      }
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;
  });

  suiteTeardown(() => {
    globalThis.fetch = realFetch;
  });

  test("lists skills inside category folders and legacy top-level skills", async () => {
    const skills = await fetchSkillList();
    assert.deepStrictEqual(
      skills.map((s) => s.dirName).sort(),
      ["cloudinary-docs", "cloudinary-react", "cloudinary-video", "legacy-skill"]
    );
    const video = skills.find((s) => s.dirName === "cloudinary-video");
    assert.strictEqual(video?.description, "Video");
  });

  test("reads a skill's SKILL.md from its category folder", async () => {
    const content = await fetchSkillContent("cloudinary-react");
    assert.ok(content.includes("Body of cloudinary-react"));
  });

  test("reads reference files from the skill's category folder", async () => {
    const refs = await fetchReferenceFiles("cloudinary-video");
    assert.deepStrictEqual(refs, [{ name: "player.md", content: "Player notes" }]);
    assert.ok(
      requested.includes(`${BASE}/skills/platform/cloudinary-video/references/player.md`)
    );
  });
});
