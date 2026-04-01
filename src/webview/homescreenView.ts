/**
 * Homescreen WebviewView provider.
 * Renders the minimal dashboard in the Cloudinary sidebar.
 */

import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import { createWebviewDocument, getScriptUri } from "./webviewUtils";
import { escapeHtml } from "./utils/helpers";

export class HomescreenViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cloudinaryHomescreen";

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: CloudinaryTreeDataProvider
  ) {}

  private _webviewView: vscode.WebviewView | undefined;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._webviewView = webviewView;

    webviewView.onDidDispose(() => {
      this._webviewView = undefined;
    });

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    const scriptUri = getScriptUri(
      webviewView.webview,
      this._extensionUri,
      "homescreen.js"
    );

    webviewView.webview.html = createWebviewDocument({
      title: "Cloudinary",
      webview: webviewView.webview,
      extensionUri: this._extensionUri,
      bodyContent: this._getBodyContent(),
      additionalScripts: [scriptUri],
    });

    webviewView.webview.onDidReceiveMessage(
      (message: { command: string }) => {
        switch (message.command) {
          case "openGlobalConfig":
            vscode.commands.executeCommand("cloudinary.openGlobalConfig");
            break;
          case "showLibrary":
            vscode.commands.executeCommand("cloudinary.showLibrary");
            break;
          case "openUploadWidget":
            vscode.commands.executeCommand("cloudinary.openUploadWidget");
            break;
          case "openWelcomeScreen":
            vscode.commands.executeCommand("cloudinary.openWelcomeScreen");
            break;
          case "configureAiTools":
            vscode.commands.executeCommand("cloudinary.configureAiTools");
            break;
        }
      }
    );
  }

  /**
   * Re-renders the homescreen HTML with current credentials.
   * Safe to call at any time; no-ops if the view has not been resolved yet.
   */
  refresh(): void {
    if (!this._webviewView) {
      return;
    }
    const scriptUri = getScriptUri(
      this._webviewView.webview,
      this._extensionUri,
      "homescreen.js"
    );
    this._webviewView.webview.html = createWebviewDocument({
      title: "Cloudinary",
      webview: this._webviewView.webview,
      extensionUri: this._extensionUri,
      bodyContent: this._getBodyContent(),
      additionalScripts: [scriptUri],
    });
  }

  private _getBodyContent(): string {
    const hasConfig = !!(this._provider.cloudName && this._provider.apiKey);
    const cloudName = escapeHtml(this._provider.cloudName || "");

    return `
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body { background: var(--vscode-sideBar-background); }

        .hs-root {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
        }

        /* ── Header ── */
        .hs-header {
          padding: 18px 16px 16px;
          background: linear-gradient(145deg, #1e3a8a 0%, #3448C5 55%, #5b73f0 100%);
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }
        .hs-header::before {
          content: '';
          position: absolute;
          top: -24px; right: -24px;
          width: 110px; height: 110px;
          background: rgba(255,255,255,0.06);
          border-radius: 50%;
          pointer-events: none;
        }
        .hs-header::after {
          content: '';
          position: absolute;
          bottom: -32px; left: 30px;
          width: 70px; height: 70px;
          background: rgba(255,255,255,0.04);
          border-radius: 50%;
          pointer-events: none;
        }

        .hs-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          position: relative;
        }
        .hs-brand-icon { width: 22px; height: 22px; flex-shrink: 0; }
        .hs-brand-name {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.95);
        }

        .hs-cloud-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
        }
        .hs-cloud-name {
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 160px;
        }
        .hs-cloud-name--placeholder {
          font-size: 13px;
          font-weight: 400;
          color: rgba(255,255,255,0.6);
          font-style: italic;
        }
        .hs-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 9px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.2px;
          color: rgba(255,255,255,0.92);
          background: rgba(255,255,255,0.14);
          flex-shrink: 0;
        }
        .hs-status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #4ade80;
          box-shadow: 0 0 5px rgba(74,222,128,0.8);
          flex-shrink: 0;
        }
        .hs-status-dot--warn {
          background: #fbbf24;
          box-shadow: 0 0 5px rgba(251,191,36,0.8);
        }

        /* ── Setup banner ── */
        .hs-setup-banner {
          margin: 10px 10px 0;
          padding: 9px 11px;
          border-radius: 8px;
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.22);
          display: flex;
          align-items: center;
          gap: 8px;
          animation: hs-in 0.2s ease both;
        }
        .hs-setup-banner-icon {
          font-size: 13px;
          flex-shrink: 0;
          line-height: 1;
        }
        .hs-setup-banner-text {
          flex: 1;
          font-size: 11px;
          color: var(--vscode-foreground);
          opacity: 0.85;
          line-height: 1.4;
        }
        .hs-setup-banner-btn {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 600;
          color: #f59e0b;
          background: rgba(251,191,36,0.14);
          border: 1px solid rgba(251,191,36,0.3);
          border-radius: 5px;
          padding: 3px 9px;
          cursor: pointer;
          font-family: var(--vscode-font-family);
          transition: background 0.12s;
        }
        .hs-setup-banner-btn:hover { background: rgba(251,191,36,0.24); }

        /* ── Actions ── */
        .hs-actions {
          padding: 8px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1px;
          animation: hs-in 0.22s ease 0.04s both;
        }

        .hs-action {
          display: flex;
          align-items: center;
          gap: 11px;
          width: 100%;
          padding: 9px 10px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: var(--vscode-foreground);
          cursor: pointer;
          font-family: var(--vscode-font-family);
          text-align: left;
          transition: background 0.12s ease;
        }
        .hs-action:hover { background: var(--vscode-list-hoverBackground); }
        .hs-action:focus-visible {
          outline: 1px solid var(--vscode-focusBorder);
          outline-offset: -1px;
          border-radius: 7px;
        }
        .hs-action:disabled {
          cursor: default;
          opacity: 0.55;
        }
        .hs-action:disabled:hover { background: transparent; }

        .hs-action-icon {
          width: 30px; height: 30px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .hs-action-icon--blue {
          background: rgba(52,72,197,0.14);
          color: #3448C5;
        }
        .hs-action-icon--green {
          background: rgba(16,185,129,0.12);
          color: #10b981;
        }
        .hs-action-icon--violet {
          background: rgba(139,92,246,0.12);
          color: #8b5cf6;
        }

        .hs-action-text { flex: 1; min-width: 0; }
        .hs-action-title {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--vscode-foreground);
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .hs-action-desc {
          font-size: 10.5px;
          color: var(--vscode-descriptionForeground);
          line-height: 1.3;
          margin-top: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hs-chip {
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(139,92,246,0.14);
          color: #8b5cf6;
          border: 1px solid rgba(139,92,246,0.2);
        }

        .hs-chevron {
          flex-shrink: 0;
          color: var(--vscode-descriptionForeground);
          opacity: 0.4;
        }

        .hs-section-divider {
          height: 1px;
          margin: 4px 6px;
          background: var(--vscode-panel-border, rgba(128,128,128,0.14));
        }

        /* ── Footer ── */
        .hs-footer {
          padding: 8px 16px 12px;
          border-top: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.12));
          animation: hs-in 0.22s ease 0.08s both;
        }
        .hs-footer-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--vscode-textLink-foreground);
          cursor: pointer;
          text-decoration: none;
          background: none;
          border: none;
          font-family: var(--vscode-font-family);
          padding: 0;
        }
        .hs-footer-link:hover { text-decoration: underline; }
        .hs-footer-link:focus-visible { outline: 1px solid var(--vscode-focusBorder); }

        @keyframes hs-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hs-header { animation: hs-in 0.18s ease both; }
      </style>

      <div class="hs-root">
        <div class="hs-header">
          <div class="hs-brand">
            <svg class="hs-brand-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M19.5 9.5a6.5 6.5 0 0 0-12.47-2A5 5 0 0 0 7 17.5h12a4.5 4.5 0 0 0 .5-8.97z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
            </svg>
            <span class="hs-brand-name">Cloudinary</span>
          </div>
          <div class="hs-cloud-row">
            <span class="hs-cloud-name${hasConfig ? "" : " hs-cloud-name--placeholder"}">${hasConfig ? cloudName : "Not configured"}</span>
            <span class="hs-status-pill">
              <span class="hs-status-dot${hasConfig ? "" : " hs-status-dot--warn"}"></span>
              ${hasConfig ? "Connected" : "Setup needed"}
            </span>
          </div>
        </div>

        ${!hasConfig ? `
        <div class="hs-setup-banner">
          <span class="hs-setup-banner-icon">⚠</span>
          <span class="hs-setup-banner-text">Add your API credentials to connect</span>
          <button id="hs-btn-configure" class="hs-setup-banner-btn">Configure</button>
        </div>
        ` : ""}

        <div class="hs-actions">
          <button id="hs-btn-library" class="hs-action">
            <span class="hs-action-icon hs-action-icon--blue" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Browse Library</span>
              <span class="hs-action-desc">Explore your media assets</span>
            </span>
            <svg class="hs-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <button id="hs-btn-upload" class="hs-action">
            <span class="hs-action-icon hs-action-icon--green" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3zM1.5 14.5a.5.5 0 0 1 0-1h13a.5.5 0 0 1 0 1h-13z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Upload</span>
              <span class="hs-action-desc">Add files to your library</span>
            </span>
            <svg class="hs-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>

          <div class="hs-section-divider" role="separator"></div>

          <button id="hs-btn-ai-tools" class="hs-action">
            <span class="hs-action-icon hs-action-icon--violet" aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.734 1.734 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.734 1.734 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.734 1.734 0 0 0 3.407 2.31l.387-1.162zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1z"/></svg>
            </span>
            <span class="hs-action-text">
              <span class="hs-action-title">Configure AI Tools</span>
              <span class="hs-action-desc">MCP servers &amp; agent skills</span>
            </span>
          </button>
        </div>

        <div class="hs-footer">
          <button id="hs-link-welcome" class="hs-footer-link">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/></svg>
            Welcome Guide
          </button>
        </div>
      </div>
    `;
  }
}
