import * as vscode from "vscode";
import { CloudinaryService } from "../cloudinary/cloudinaryService";
import {
  createWebviewDocument,
  getScriptUri,
} from "../webview/webviewUtils";
import { escapeHtml } from "../webview/utils/helpers";

type WelcomeScreenCloudinaryState = Pick<CloudinaryService, "cloudName" | "apiKey">;

/**
 * Registers the welcome screen command.
 */
function registerWelcomeScreen(
  context: vscode.ExtensionContext,
  cloudinaryState: WelcomeScreenCloudinaryState
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openWelcomeScreen", () => {
      createWelcomePanel(context, cloudinaryState);
    })
  );
}

/**
 * Creates the welcome screen webview panel.
 */
function createWelcomePanel(
  context: vscode.ExtensionContext,
  cloudinaryState: WelcomeScreenCloudinaryState
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "cloudinaryWelcome",
    "Welcome to Cloudinary",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "media"),
      ],
    }
  );

  panel.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "cloudinary_icon_blue.png"
  );

  const welcomeScriptUri = getScriptUri(
    panel.webview,
    context.extensionUri,
    "welcome.js"
  );

  panel.webview.html = createWebviewDocument({
    title: "Welcome to Cloudinary",
    webview: panel.webview,
    extensionUri: context.extensionUri,
    bodyContent: getWelcomeContent(cloudinaryState),
    additionalScripts: [welcomeScriptUri],
  });

  panel.webview.onDidReceiveMessage((message: { command: string; data?: string; text?: string }) => {
    switch (message.command) {
      case "openGlobalConfig":
        vscode.commands.executeCommand("cloudinary.openGlobalConfig");
        break;
      case "copyToClipboard": {
        const text = message.text ?? message.data;
        if (text) {
          vscode.env.clipboard.writeText(text);
        }
        break;
      }
      case "openExternal":
        if (message.data) {
          vscode.env.openExternal(vscode.Uri.parse(message.data));
        }
        break;
      case "focusDashboard":
        vscode.commands.executeCommand("workbench.view.extension.cloudinary");
        break;
    }
  });

  return panel;
}

/**
 * Generates the welcome screen body content.
 */
function getWelcomeContent(cloudinaryState: WelcomeScreenCloudinaryState): string {
  const hasConfig = !!(cloudinaryState.cloudName && cloudinaryState.apiKey);
  const cloudName = escapeHtml(cloudinaryState.cloudName || "");

  return `
  <style>
    .wg-root {
      max-width: 720px;
      margin: 0 auto;
      padding: 0 0 60px;
    }

    /* ── Hero ── */
    .wg-hero {
      background: linear-gradient(145deg, #1b295d 0%, #23436a 35%, #3448C5 70%, #5b73f0 100%);
      padding: 48px 48px 44px;
      position: relative;
      overflow: hidden;
    }
    .wg-hero::before {
      content: '';
      position: absolute; top: -50px; right: -50px;
      width: 240px; height: 240px;
      background: rgba(255,255,255,0.04);
      border-radius: 50%;
      pointer-events: none;
    }
    .wg-hero::after {
      content: '';
      position: absolute; bottom: -60px; left: 30px;
      width: 160px; height: 160px;
      background: rgba(255,255,255,0.03);
      border-radius: 50%;
      pointer-events: none;
    }
    .wg-hero-brand {
      display: flex; align-items: center; gap: 9px;
      margin-bottom: 20px; position: relative;
    }
    .wg-hero-brand svg { width: 26px; height: 26px; flex-shrink: 0; }
    .wg-hero-brand-name {
      font-size: 11px; font-weight: 700;
      letter-spacing: 1.4px; text-transform: uppercase;
      color: rgba(255,255,255,0.7);
    }
    .wg-hero-title {
      font-size: 28px; font-weight: 700; color: #fff;
      line-height: 1.2; margin-bottom: 10px; position: relative;
    }
    .wg-hero-sub {
      font-size: 14px; color: rgba(255,255,255,0.68);
      line-height: 1.55; position: relative;
    }

    /* ── Body ── */
    .wg-body { padding: 36px 48px 0; }

    /* ── Status ── */
    .wg-status {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 18px; border-radius: 9px; margin-bottom: 36px;
      border: 1px solid transparent;
      animation: wg-in 0.3s ease both;
    }
    .wg-status--ok  { background: rgba(74,222,128,0.07);  border-color: rgba(74,222,128,0.22); }
    .wg-status--warn{ background: rgba(251,191,36,0.07);  border-color: rgba(251,191,36,0.22); }
    .wg-status-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    }
    .wg-status--ok   .wg-status-dot { background: #4ade80; box-shadow: 0 0 7px rgba(74,222,128,0.65); }
    .wg-status--warn .wg-status-dot { background: #fbbf24; box-shadow: 0 0 7px rgba(251,191,36,0.65); }
    .wg-status-body { flex: 1; }
    .wg-status-label  { font-size: 13px; font-weight: 600; }
    .wg-status-detail { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }

    /* ── Section label ── */
    .wg-section-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.9px;
      text-transform: uppercase; color: var(--vscode-descriptionForeground);
      margin-bottom: 14px;
    }

    /* ── Steps ── */
    .wg-steps { display: flex; flex-direction: column; gap: 10px; margin-bottom: 36px; }
    .wg-step {
      display: flex; gap: 18px; padding: 20px 22px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.15));
      border-radius: 10px;
      animation: wg-up 0.35s ease both;
      transition: border-color 0.15s;
    }
    .wg-step:nth-child(1){ animation-delay: 0.06s; }
    .wg-step:nth-child(2){ animation-delay: 0.12s; }
    .wg-step:nth-child(3){ animation-delay: 0.18s; }
    .wg-step:hover { border-color: rgba(13,154,255,0.3); }
    .wg-step-num {
      width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; flex-shrink: 0; margin-top: 1px;
      background: linear-gradient(135deg, #0D9AFF 0%, #5b73f0 100%);
      color: #fff;
    }
    .wg-step-num--done {
      background: linear-gradient(135deg, #34d399 0%, #059669 100%);
    }
    .wg-step-body { flex: 1; min-width: 0; }
    .wg-step-title {
      font-size: 14px; font-weight: 600;
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 5px;
    }
    .wg-step-desc {
      font-size: 12px; color: var(--vscode-descriptionForeground);
      line-height: 1.55; margin-bottom: 14px;
    }
    .wg-step-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    /* ── Done badge ── */
    .wg-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px; border-radius: 20px;
      font-size: 10px; font-weight: 600;
      background: rgba(52,211,153,0.12); color: #34d399;
      border: 1px solid rgba(52,211,153,0.28);
    }

    /* ── Config collapsible ── */
    .wg-config { margin-bottom: 36px; animation: wg-in 0.3s ease 0.22s both; }
    .wg-config summary {
      display: flex; align-items: center; gap: 8px;
      padding: 11px 16px; cursor: pointer; list-style: none;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.15));
      border-radius: 8px;
      font-size: 12px; font-weight: 500;
      color: var(--vscode-editor-foreground);
      user-select: none; transition: border-color 0.15s;
    }
    .wg-config summary::-webkit-details-marker { display: none; }
    .wg-config summary::before {
      content: '▶'; font-size: 8px;
      color: var(--vscode-descriptionForeground);
      transition: transform 0.2s; flex-shrink: 0;
    }
    .wg-config[open] summary::before { transform: rotate(90deg); }
    .wg-config[open] summary {
      border-radius: 8px 8px 0 0;
      border-color: rgba(13,154,255,0.25);
      border-bottom-color: transparent;
    }
    .wg-config summary:hover { border-color: rgba(13,154,255,0.3); }
    .wg-config-body {
      padding: 16px 18px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid rgba(13,154,255,0.2);
      border-top: none; border-radius: 0 0 8px 8px;
    }
    .wg-config-note {
      font-size: 12px; color: var(--vscode-descriptionForeground);
      line-height: 1.55; margin-bottom: 12px;
    }
    .wg-mono {
      font-family: var(--vscode-editor-font-family, monospace); font-size: 11px;
      background: var(--vscode-textBlockQuote-background, rgba(128,128,128,0.1));
      padding: 1px 5px; border-radius: 3px;
    }
    .wg-code {
      position: relative;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.12));
      border-radius: 6px; overflow: hidden;
    }
    .wg-code pre {
      padding: 14px 16px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px; line-height: 1.6; overflow-x: auto;
      white-space: pre; color: var(--vscode-editor-foreground); margin: 0;
    }
    .wg-code-copy { position: absolute; top: 8px; right: 8px; }
    .wg-link {
      color: var(--vscode-textLink-foreground, #0D9AFF);
      cursor: pointer;
    }
    .wg-link:hover { text-decoration: underline; }

    /* ── Divider ── */
    .wg-divider {
      height: 1px;
      background: var(--vscode-editorWidget-border, rgba(128,128,128,0.12));
      margin: 36px 0;
    }

    /* ── Resources ── */
    .wg-resources { animation: wg-in 0.3s ease 0.28s both; }
    .wg-res-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    }
    .wg-res-card {
      padding: 16px;
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.15));
      border-radius: 9px; cursor: pointer;
      transition: border-color 0.15s, transform 0.12s;
    }
    .wg-res-card:hover { border-color: rgba(13,154,255,0.32); transform: translateY(-1px); }
    .wg-res-icon { font-size: 20px; margin-bottom: 8px; line-height: 1; }
    .wg-res-title { font-size: 12px; font-weight: 600; margin-bottom: 3px; }
    .wg-res-desc { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.4; }

    /* ── Buttons ── */
    .wg-btn {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 14px; border-radius: 5px;
      font-size: 12px; font-weight: 500; cursor: pointer;
      border: 1px solid transparent;
      font-family: var(--vscode-font-family);
      transition: opacity 0.13s, transform 0.1s; line-height: 1.4;
    }
    .wg-btn:active { transform: scale(0.97); }
    .wg-btn--primary { background: #0D9AFF; color: #fff; border-color: #0D9AFF; }
    .wg-btn--primary:hover { opacity: 0.88; }
    .wg-btn--ghost {
      background: transparent; color: var(--vscode-editor-foreground);
      border-color: var(--vscode-editorWidget-border, rgba(128,128,128,0.3));
    }
    .wg-btn--ghost:hover { border-color: rgba(13,154,255,0.4); color: #0D9AFF; }
    .wg-btn--sm { padding: 4px 10px; font-size: 11px; }

    /* ── Animations ── */
    @keyframes wg-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes wg-up { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
  </style>

  <div class="wg-root">

    <!-- ── Hero ── -->
    <div class="wg-hero">
      <div class="wg-hero-brand">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M19.5 9.5a6.5 6.5 0 0 0-12.47-2A5 5 0 0 0 7 17.5h12a4.5 4.5 0 0 0 .5-8.97z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
        </svg>
        <span class="wg-hero-brand-name">Cloudinary</span>
      </div>
      <h1 class="wg-hero-title">Welcome to Cloudinary</h1>
      <p class="wg-hero-sub">Your media management hub, right inside VS Code — let's get you set up.</p>
    </div>

    <div class="wg-body">

      <!-- ── Connection status ── -->
      <div class="wg-status wg-status--${hasConfig ? "ok" : "warn"}">
        <div class="wg-status-dot"></div>
        <div class="wg-status-body">
          <div class="wg-status-label">${hasConfig ? `Connected to ${cloudName}` : "No credentials configured"}</div>
          <div class="wg-status-detail">${hasConfig ? "Your environment is ready. Open the dashboard to explore your media." : "Add your Cloudinary API credentials to get started."}</div>
        </div>
        ${hasConfig
      ? `<button class="wg-btn wg-btn--ghost" onclick="focusDashboard()">Open Dashboard →</button>`
      : `<button class="wg-btn wg-btn--primary" onclick="openGlobalConfig()">Configure →</button>`
    }
      </div>

      <!-- ── Setup steps ── -->
      <div class="wg-section-label">Setup</div>
      <div class="wg-steps">

        <div class="wg-step">
          <div class="wg-step-num ${hasConfig ? "wg-step-num--done" : ""}">${hasConfig ? "✓" : "1"}</div>
          <div class="wg-step-body">
            <div class="wg-step-title">
              Connect your Cloudinary account
              ${hasConfig ? '<span class="wg-badge">✓ Done</span>' : ""}
            </div>
            <p class="wg-step-desc">
              Add your Cloud Name, API Key, and API Secret to
              <span class="wg-mono">~/.cloudinary/environments.json</span>.
              Credentials are never stored in VS Code settings — they stay in a local file you control.
            </p>
            <div class="wg-step-actions">
              <button class="wg-btn wg-btn--primary" onclick="openGlobalConfig()">${hasConfig ? "View Config File" : "Open Config File"}</button>
              <button class="wg-btn wg-btn--ghost" onclick="openExternal('https://console.cloudinary.com/settings/api-keys')">Get API Keys</button>
            </div>
          </div>
        </div>

        <div class="wg-step">
          <div class="wg-step-num">2</div>
          <div class="wg-step-body">
            <div class="wg-step-title">Explore the Dashboard</div>
            <p class="wg-step-desc">The Cloudinary sidebar gives you instant access to your media library, upload tools, and AI integrations — all without leaving your editor. Open it from the activity bar on the left.</p>
            <div class="wg-step-actions">
              <button class="wg-btn wg-btn--primary" onclick="focusDashboard()">Open Dashboard</button>
            </div>
          </div>
        </div>

        <div class="wg-step">
          <div class="wg-step-num">3</div>
          <div class="wg-step-body">
            <div class="wg-step-title">Browse &amp; manage your media</div>
            <p class="wg-step-desc">Search and explore assets in the media library. Preview images and videos, copy delivery URLs, upload new files with drag-and-drop, and manage transformations — all from VS Code.</p>
            <div class="wg-step-actions">
              <button class="wg-btn wg-btn--ghost" onclick="openExternal('https://cloudinary.com/documentation/how_to_integrate_cloudinary')">View Documentation</button>
            </div>
          </div>
        </div>

      </div>

      <!-- ── Config format ── -->
      <details class="wg-config"${!hasConfig ? " open" : ""}>
        <summary>Configuration file format</summary>
        <div class="wg-config-body">
          <p class="wg-config-note">
            Create <span class="wg-mono">~/.cloudinary/environments.json</span> with the following structure.
            The cloud name is the key. You can define multiple environments.
          </p>
          <div class="wg-code">
            <button class="wg-btn wg-btn--ghost wg-btn--sm wg-code-copy" onclick="copyToClipboard(getConfigExample(), this)">Copy</button>
            <pre>{
  "your-cloud-name": {
    "apiKey": "your-api-key",
    "apiSecret": "your-api-secret"
  }
}</pre>
          </div>
          <p class="wg-config-note" style="margin-top:12px;margin-bottom:0;">
            Find your credentials at
            <span class="wg-link" onclick="openExternal('https://console.cloudinary.com/settings/api-keys')">Console → Settings → API Keys</span>.
            You can optionally include <span class="wg-mono">uploadPreset</span> for upload configuration.
          </p>
        </div>
      </details>

      <div class="wg-divider"></div>

      <!-- ── Resources ── -->
      <div class="wg-resources">
        <div class="wg-section-label">Resources</div>
        <div class="wg-res-grid">
          <div class="wg-res-card" onclick="openExternal('https://cloudinary.com/documentation')">
            <div class="wg-res-icon">📖</div>
            <div class="wg-res-title">Documentation</div>
            <div class="wg-res-desc">Guides, API reference &amp; tutorials</div>
          </div>
          <div class="wg-res-card" onclick="openExternal('https://console.cloudinary.com')">
            <div class="wg-res-icon">🖥</div>
            <div class="wg-res-title">Console</div>
            <div class="wg-res-desc">Manage your media &amp; settings online</div>
          </div>
          <div class="wg-res-card" onclick="openExternal('https://cloudinary.com/documentation/upload_images')">
            <div class="wg-res-icon">⬆</div>
            <div class="wg-res-title">Upload Guide</div>
            <div class="wg-res-desc">Learn to upload &amp; organize assets</div>
          </div>
          <div class="wg-res-card" onclick="openExternal('https://cloudinary.com/documentation/image_transformations')">
            <div class="wg-res-icon">✨</div>
            <div class="wg-res-title">Transformations</div>
            <div class="wg-res-desc">Resize, crop &amp; optimize media</div>
          </div>
          <div class="wg-res-card" onclick="openExternal('https://support.cloudinary.com')">
            <div class="wg-res-icon">💬</div>
            <div class="wg-res-title">Support</div>
            <div class="wg-res-desc">Get help from the Cloudinary team</div>
          </div>
          <div class="wg-res-card" onclick="openExternal('https://cloudinary.com/users/register_free')">
            <div class="wg-res-icon">🌱</div>
            <div class="wg-res-title">Free Account</div>
            <div class="wg-res-desc">New to Cloudinary? Sign up free</div>
          </div>
        </div>
      </div>

    </div>
  </div>
  `;
}

export default registerWelcomeScreen;
