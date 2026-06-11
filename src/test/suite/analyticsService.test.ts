import * as assert from "assert";
import { AnalyticsService } from "../../analytics/analyticsService";

class FakeStorage {
  private values = new Map<string, unknown>();

  get<T>(key: string, defaultValue: T): T {
    return this.values.has(key) ? this.values.get(key) as T : defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
}

suite("AnalyticsService", () => {
  test("sends analytics events with common context", async () => {
    const urls: string[] = [];
    const methods: string[] = [];
    const service = new AnalyticsService({
      extensionVersion: "1.2.3",
      storage: new FakeStorage(),
      getCloudName: () => "demo",
      getDebugId: () => "debug-1",
      getIdePlatform: () => "vscode",
      createSessionId: () => "session-1",
      now: () => new Date("2026-03-09T14:27:36.000Z"),
      fetchFn: async (url, init) => {
        urls.push(url);
        methods.push(init.method);
      },
    });

    await service.send("library_opened", { resource_type: "image", count: 2 });

    assert.strictEqual(urls.length, 1);
    assert.deepStrictEqual(methods, ["POST"]);
    const url = new URL(urls[0]);
    assert.strictEqual(url.origin, "https://analytics-api.cloudinary.com");
    assert.strictEqual(url.pathname, "/vscode_extension");
    assert.strictEqual(url.searchParams.get("source"), "vscode_extension");
    assert.strictEqual(url.searchParams.get("event"), "library_opened");
    assert.strictEqual(url.searchParams.get("extension_version"), "1.2.3");
    assert.strictEqual(url.searchParams.get("ide_platform"), "vscode");
    assert.strictEqual(url.searchParams.get("cloud_name"), "demo");
    assert.strictEqual(url.searchParams.get("debug_id"), "debug-1");
    assert.strictEqual(url.searchParams.get("session_id"), "session-1");
    assert.strictEqual(url.searchParams.get("event_time"), "2026-03-09T14:27:36.000Z");
    assert.strictEqual(url.searchParams.get("resource_type"), "image");
    assert.strictEqual(url.searchParams.get("count"), "2");
  });

  test("persists and reuses a session id", async () => {
    const storage = new FakeStorage();
    const urls: string[] = [];
    let createCount = 0;
    const service = new AnalyticsService({
      extensionVersion: "1.2.3",
      storage,
      createSessionId: () => `session-${++createCount}`,
      fetchFn: async (url) => {
        urls.push(url);
      },
    });

    await service.send("extension_activated");
    await service.send("home_opened");

    assert.strictEqual(createCount, 1);
    assert.strictEqual(new URL(urls[0]).searchParams.get("session_id"), "session-1");
    assert.strictEqual(new URL(urls[1]).searchParams.get("session_id"), "session-1");
    assert.strictEqual(new URL(urls[0]).searchParams.get("event"), "extension_activated");
    assert.strictEqual(new URL(urls[1]).searchParams.get("event"), "home_opened");
  });

  test("drops unsafe event names and sensitive payload fields", async () => {
    const urls: string[] = [];
    const service = new AnalyticsService({
      extensionVersion: "1.2.3",
      storage: new FakeStorage(),
      fetchFn: async (url) => {
        urls.push(url);
      },
    });

    await service.send("bad/event", { action: "ignored" });
    await service.send("copy_message", {
      copy_type: "code",
      Event: "do_not_override",
      nested: { should: "drop" },
      tags: ["drop"],
      infinite: Infinity,
      has_initial_prompt: true,
      prompt: "do not send",
      apiKey: "do not send",
      "client.secret": "do not send",
      api_secret: "do not send",
      email: "do-not-send@example.com",
      "user.email": "do-not-send@example.com",
      accessToken: "do not send",
    });

    assert.strictEqual(urls.length, 1);
    const url = new URL(urls[0]);
    assert.strictEqual(url.pathname, "/vscode_extension");
    assert.strictEqual(url.searchParams.get("event"), "copy_message");
    assert.strictEqual(url.searchParams.get("copy_type"), "code");
    assert.strictEqual(url.searchParams.get("has_initial_prompt"), "true");
    assert.strictEqual(url.searchParams.has("Event"), false);
    assert.strictEqual(url.searchParams.has("nested"), false);
    assert.strictEqual(url.searchParams.has("tags"), false);
    assert.strictEqual(url.searchParams.has("infinite"), false);
    assert.strictEqual(url.searchParams.has("prompt"), false);
    assert.strictEqual(url.searchParams.has("apiKey"), false);
    assert.strictEqual(url.searchParams.has("client.secret"), false);
    assert.strictEqual(url.searchParams.has("api_secret"), false);
    assert.strictEqual(url.searchParams.has("email"), false);
    assert.strictEqual(url.searchParams.has("user.email"), false);
    assert.strictEqual(url.searchParams.has("accessToken"), false);
  });

  test("swallows delivery failures", async () => {
    const service = new AnalyticsService({
      extensionVersion: "1.2.3",
      storage: new FakeStorage(),
      fetchFn: async () => {
        throw new Error("network down");
      },
    });

    await assert.doesNotReject(() => service.send("extension_activated"));
  });
});
