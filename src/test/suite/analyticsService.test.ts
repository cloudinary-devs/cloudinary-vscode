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
    const service = new AnalyticsService({
      extensionVersion: "1.2.3",
      storage: new FakeStorage(),
      getCloudName: () => "demo",
      getDebugId: () => "debug-1",
      getIdePlatform: () => "vscode",
      createSessionId: () => "session-1",
      now: () => new Date("2026-03-09T14:27:36.000Z"),
      fetchFn: async (url) => {
        urls.push(url);
      },
    });

    await service.send("library_opened", { resource_type: "image", count: 2 });

    assert.strictEqual(urls.length, 1);
    const url = new URL(urls[0]);
    assert.strictEqual(url.origin, "https://analytics-api.cloudinary.com");
    assert.strictEqual(url.pathname, "/library_opened");
    assert.strictEqual(url.searchParams.get("source"), "vscode_extension");
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
      has_initial_prompt: true,
      prompt: "do not send",
      apiKey: "do not send",
      api_secret: "do not send",
      email: "do-not-send@example.com",
    });

    assert.strictEqual(urls.length, 1);
    const url = new URL(urls[0]);
    assert.strictEqual(url.pathname, "/copy_message");
    assert.strictEqual(url.searchParams.get("copy_type"), "code");
    assert.strictEqual(url.searchParams.get("has_initial_prompt"), "true");
    assert.strictEqual(url.searchParams.has("prompt"), false);
    assert.strictEqual(url.searchParams.has("apiKey"), false);
    assert.strictEqual(url.searchParams.has("api_secret"), false);
    assert.strictEqual(url.searchParams.has("email"), false);
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
