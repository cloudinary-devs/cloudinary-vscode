import * as assert from "assert";
import * as vscode from "vscode";
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

/**
 * These flows are driven by QuickPicks and webview panels that cannot be opened
 * headlessly, so the commands themselves are covered by the extension's own
 * activation. What is asserted here is the part that silently breaks: whether
 * each event name and payload key survives AnalyticsService intact.
 */
function createRecorder(): { analytics: AnalyticsService; urls: string[] } {
  const urls: string[] = [];
  const analytics = new AnalyticsService({
    extensionVersion: "1.2.3",
    storage: new FakeStorage(),
    getCloudName: () => "demo",
    createSessionId: () => "session-1",
    fetchFn: async (url) => {
      urls.push(url);
    },
  });
  return { analytics, urls };
}

function paramsOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

suite("Environment switch, welcome screen and library view analytics", () => {
  test("environment switch events keep their outcome payload", async () => {
    const { analytics, urls } = createRecorder();

    await analytics.send("environment_switch_opened", {
      entry_point: "status_bar",
      environment_count: 3,
    });
    await analytics.send("environment_switched", {
      entry_point: "homescreen",
      environment_count: 3,
      credentials_valid: false,
      folder_mode: "dynamic",
    });
    await analytics.send("environment_switch_failed", {
      entry_point: "command",
      failure_reason: "no_environments",
    });

    assert.strictEqual(urls.length, 3, "all three event names must be accepted");

    const opened = paramsOf(urls[0]);
    assert.strictEqual(opened.get("event"), "environment_switch_opened");
    assert.strictEqual(opened.get("entry_point"), "status_bar");
    assert.strictEqual(opened.get("environment_count"), "3");

    const switched = paramsOf(urls[1]);
    assert.strictEqual(switched.get("event"), "environment_switched");
    assert.strictEqual(switched.get("credentials_valid"), "false");
    assert.strictEqual(switched.get("folder_mode"), "dynamic");

    const failed = paramsOf(urls[2]);
    assert.strictEqual(failed.get("failure_reason"), "no_environments");
  });

  test("welcome screen events distinguish first run from a revisit", async () => {
    const { analytics, urls } = createRecorder();

    await analytics.send("welcome_opened", {
      entry_point: "first_run",
      reopened: false,
      connection_status: "setupNeeded",
    });
    await analytics.send("welcome_opened", {
      entry_point: "homescreen",
      reopened: true,
      connection_status: "connected",
    });
    await analytics.send("welcome_action", { action: "copy_snippet" });
    await analytics.send("welcome_action", { action: "open_external", target: "cloudinary.com" });

    assert.strictEqual(urls.length, 4);

    const firstRun = paramsOf(urls[0]);
    assert.strictEqual(firstRun.get("entry_point"), "first_run");
    assert.strictEqual(firstRun.get("reopened"), "false");
    assert.strictEqual(firstRun.get("connection_status"), "setupNeeded");

    const revisit = paramsOf(urls[1]);
    assert.strictEqual(revisit.get("reopened"), "true");
    assert.strictEqual(revisit.get("connection_status"), "connected");

    assert.strictEqual(paramsOf(urls[2]).get("action"), "copy_snippet");
    // Host only: a full URL would leak what the user was reading.
    assert.strictEqual(paramsOf(urls[3]).get("target"), "cloudinary.com");
  });

  test("library filter and sort are separate events", async () => {
    const { analytics, urls } = createRecorder();

    await analytics.send("library_view_options_opened");
    await analytics.send("library_filter_changed", { resource_type: "video" });
    await analytics.send("library_sort_changed", { sort_direction: "asc" });

    assert.deepStrictEqual(
      urls.map((url) => paramsOf(url).get("event")),
      ["library_view_options_opened", "library_filter_changed", "library_sort_changed"]
    );
    assert.strictEqual(paramsOf(urls[1]).get("resource_type"), "video");
    assert.strictEqual(paramsOf(urls[2]).get("sort_direction"), "asc");
  });

  test("the extension contributes the commands that emit these events", () => {
    // Asserted against the manifest rather than the live command registry on
    // purpose: activating the extension here would build the real
    // AnalyticsService with real fetch and POST extension_activated to
    // production analytics on every test run, CI included.
    const extension = vscode.extensions.getExtension("Cloudinary.cloudinary");
    assert.ok(extension, "extension should be discoverable in the test host");

    const contributed: string[] = (extension.packageJSON?.contributes?.commands ?? [])
      .map((entry: { command: string }) => entry.command);

    for (const id of [
      "cloudinary.switchEnvironment",
      "cloudinary.openWelcomeScreen",
      "cloudinary.viewOptions",
    ]) {
      assert.ok(contributed.includes(id), `${id} should be contributed in package.json`);
    }
  });
});
