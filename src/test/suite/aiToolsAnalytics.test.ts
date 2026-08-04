import * as assert from "assert";
import * as vscode from "vscode";
import { AnalyticsService } from "../../analytics/analyticsService";
import { CloudinaryService } from "../../cloudinary/cloudinaryService";
import { HomescreenViewProvider } from "../../webview/homescreenView";

type WebviewMessage = {
  command: string;
  platform?: string;
  scope?: string;
  skills?: string[];
  mcpServers?: string[];
};

class FakeStorage {
  private values = new Map<string, unknown>();

  get<T>(key: string, defaultValue: T): T {
    return this.values.has(key) ? this.values.get(key) as T : defaultValue;
  }

  async update(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }

  keys(): readonly string[] {
    return [...this.values.keys()];
  }
}

/**
 * Drives the homescreen message handler through a real AnalyticsService, so the
 * assertions cover event-name and payload-key validation rather than just the
 * call sites. The test runner opens no workspace folder, which is what makes the
 * no-workspace branches deterministic and free of network calls.
 */
function createProvider(): {
  send: (message: WebviewMessage) => Promise<void>;
  events: URL[];
} {
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

  const storage = new FakeStorage();
  const provider = new HomescreenViewProvider(
    vscode.Uri.file("/tmp/cloudinary-extension"),
    {} as CloudinaryService,
    storage as unknown as vscode.Memento,
    undefined,
    analytics
  );

  let handler: ((message: WebviewMessage) => Promise<void>) | undefined;
  const webview = {
    options: {},
    html: "",
    cspSource: "vscode-webview:",
    asWebviewUri: (uri: vscode.Uri) => uri,
    postMessage: async () => true,
    onDidReceiveMessage: (cb: (message: WebviewMessage) => Promise<void>) => {
      handler = cb;
      return { dispose: () => undefined };
    },
  };
  const webviewView = {
    webview,
    onDidDispose: () => ({ dispose: () => undefined }),
  };

  void provider.resolveWebviewView(
    webviewView as unknown as vscode.WebviewView,
    {} as vscode.WebviewViewResolveContext,
    {} as vscode.CancellationToken
  );

  return {
    events: [] as URL[],
    async send(message: WebviewMessage) {
      assert.ok(handler, "message handler was not registered");
      await handler(message);
      // Analytics delivery is fire-and-forget, so let the queued sends settle.
      await new Promise((resolve) => setImmediate(resolve));
      this.events.length = 0;
      this.events.push(...urls.map((url) => new URL(url)));
    },
  };
}

function eventNames(events: URL[]): string[] {
  return events.map((url) => url.searchParams.get("event") ?? "");
}

/**
 * track() is fire-and-forget and send() awaits the stored session id before
 * building the request, so two events fired back to back can reach the wire in
 * either order. Assert on the set of events, which is what the funnel counts.
 */
function assertEventSet(events: URL[], expected: string[]): void {
  assert.deepStrictEqual([...eventNames(events)].sort(), [...expected].sort());
}

function lastEvent(events: URL[], name: string): URL {
  const match = [...events].reverse().find((url) => url.searchParams.get("event") === name);
  assert.ok(match, `expected an ${name} event, got: ${eventNames(events).join(", ")}`);
  return match;
}

suite("Configure AI Tools analytics", () => {
  test("tracks opening the panel, then why it could not render", async () => {
    const harness = createProvider();

    await harness.send({ command: "aiToolsExpanded" });

    assertEventSet(harness.events, ["ai_tools_opened", "ai_tools_open_failed"]);

    const opened = lastEvent(harness.events, "ai_tools_opened");
    assert.strictEqual(opened.searchParams.get("entry_point"), "homescreen");
    assert.strictEqual(opened.searchParams.get("scope"), "project");
    // Auto-detected from the running editor, so assert only that it survived.
    assert.ok(opened.searchParams.get("platform"));

    const failed = lastEvent(harness.events, "ai_tools_open_failed");
    assert.strictEqual(failed.searchParams.get("failure_reason"), "no_workspace");
  });

  test("does not count an in-place refresh as a panel open", async () => {
    const harness = createProvider();

    await harness.send({ command: "aiToolsRefresh" });

    assert.strictEqual(
      eventNames(harness.events).includes("ai_tools_opened"),
      false,
      "refresh must not inflate the panel open count"
    );
  });

  test("tracks platform and scope changes with the selected values", async () => {
    const harness = createProvider();

    await harness.send({ command: "changePlatform", platform: "cursor" });
    const platformChanged = lastEvent(harness.events, "ai_tools_platform_changed");
    assert.strictEqual(platformChanged.searchParams.get("platform"), "cursor");

    await harness.send({ command: "changeScope", scope: "global" });
    const scopeChanged = lastEvent(harness.events, "ai_tools_scope_changed");
    assert.strictEqual(scopeChanged.searchParams.get("scope"), "global");
    // Scope changes keep the previously chosen platform.
    assert.strictEqual(scopeChanged.searchParams.get("platform"), "cursor");
  });

  test("reports requested counts on apply, and the failure reason when it cannot run", async () => {
    const harness = createProvider();

    await harness.send({
      command: "installAiTools",
      platform: "claude-code",
      scope: "project",
      skills: ["cloudinary-docs", "cloudinary-transformations"],
      mcpServers: ["cloudinary-asset-mgmt"],
    });

    assertEventSet(harness.events, ["ai_tools_install_started", "ai_tools_install_failed"]);

    const started = lastEvent(harness.events, "ai_tools_install_started");
    assert.strictEqual(started.searchParams.get("entry_point"), "homescreen");
    assert.strictEqual(started.searchParams.get("platform"), "claude-code");
    assert.strictEqual(started.searchParams.get("scope"), "project");
    assert.strictEqual(started.searchParams.get("skills_requested"), "2");
    assert.strictEqual(started.searchParams.get("mcp_requested"), "1");

    const failed = lastEvent(harness.events, "ai_tools_install_failed");
    assert.strictEqual(failed.searchParams.get("failure_reason"), "no_workspace");
    assert.strictEqual(failed.searchParams.get("skills_requested"), "2");
    assert.strictEqual(failed.searchParams.get("skills_installed"), "0");
    assert.strictEqual(failed.searchParams.get("mcp_installed"), "0");
    assert.strictEqual(failed.searchParams.get("error_count"), "1");
  });

  test("emits exactly one terminal event per apply", async () => {
    const harness = createProvider();

    await harness.send({ command: "installAiTools", skills: ["cloudinary-docs"] });

    const terminal = eventNames(harness.events).filter((name) =>
      name === "ai_tools_install_succeeded" || name === "ai_tools_install_failed"
    );
    assert.strictEqual(terminal.length, 1, `expected one terminal event, got ${terminal.join(", ")}`);
  });
});
