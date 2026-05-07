import * as vscode from "vscode";
import { getDocsAiApiBase } from "./docsAiConfig";
import { getNonce, getScriptUri, getStyleUri } from "./webviewUtils";

export class DocsAiViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cloudinaryDocsAI";

  private _view: vscode.WebviewView | undefined;
  private _pendingPrompt: string | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.onDidDispose(() => {
      this._view = undefined;
    });

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    const initialPrompt = this.consumePendingPrompt();
    view.webview.html = this.getHtml(view.webview, initialPrompt);
  }

  refresh(): void {
    const view = this._view;
    if (!view) {
      return;
    }
    const initialPrompt = this.consumePendingPrompt();
    view.webview.html = this.getHtml(view.webview, initialPrompt);
  }

  queuePrompt(prompt: unknown): void {
    const value = typeof prompt === "string" ? prompt.trim() : "";
    if (!value) {
      return;
    }
    this._pendingPrompt = value;
    this.flushPendingPrompt();
  }

  flushPendingPrompt(delay = 0): void {
    const view = this._view;
    if (!view || !this._pendingPrompt) {
      return;
    }

    const postPrompt = () => {
      if (!this._view || !this._pendingPrompt) {
        return;
      }
      const prompt = this._pendingPrompt;
      this._pendingPrompt = undefined;
      this._view.webview.postMessage({ command: "askPrompt", prompt });
    };

    if (delay > 0) {
      setTimeout(postPrompt, delay);
      return;
    }

    postPrompt();
  }

  private consumePendingPrompt(): string | undefined {
    const prompt = this._pendingPrompt;
    this._pendingPrompt = undefined;
    return prompt;
  }

  private getHtml(webview: vscode.Webview, initialPrompt?: string): string {
    const cssUri = getStyleUri(webview, this._extensionUri, "docs-ai.css");
    const scriptUri = getScriptUri(webview, this._extensionUri, "docs-ai.js");
    const nonce = getNonce();
    const appName = JSON.stringify(vscode.env.appName);
    const initialPromptJson = JSON.stringify(initialPrompt ?? "");
    const apiBase = getDocsAiApiBase();
    const apiBaseJson = JSON.stringify(apiBase);

    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
      `connect-src ${apiBase}`,
      `img-src ${webview.cspSource} https: data:`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${cssUri}">
  <title>Cloudinary Docs AI</title>
</head>
<body>
  <div class="chat-shell">
    <div class="header-wrapper">
      <div id="tab-bar" class="tab-bar">
        <div class="tab-scroll"></div>
        <div class="tab-actions">
          <button id="new-chat-btn" class="tab-action-btn" title="New chat" aria-label="New chat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button id="history-btn" class="tab-action-btn" title="Chat history" aria-label="Chat history">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button id="more-btn" class="tab-action-btn" title="More options" aria-label="More options">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
      </div>
      <div id="history-dropdown" class="history-dropdown"></div>
      <div id="more-menu" class="more-menu"></div>
    </div>

    <div id="conversation"></div>

    <section class="composer">
      <div class="input-row">
        <textarea id="chat-input" rows="1" placeholder="Send a message..." autocomplete="off" dir="auto"></textarea>
        <button id="send-btn" title="Send message" aria-label="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
        <button id="stop-btn" title="Stop generation" aria-label="Stop generation">
          <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor"/></svg>
        </button>
      </div>
      <p id="disclaimer">AI can make mistakes. Verify important info from <a href="https://cloudinary.com/documentation" target="_blank" rel="noopener noreferrer">Cloudinary docs</a>.</p>
    </section>
  </div>

  <script nonce="${nonce}">
    window.__IDE_NAME__ = ${appName};
    window.__INITIAL_PROMPT__ = ${initialPromptJson};
    window.__DOCS_AI_API_BASE__ = ${apiBaseJson};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
