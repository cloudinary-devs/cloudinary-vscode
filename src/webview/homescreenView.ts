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

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
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
          case "searchAssets":
            vscode.commands.executeCommand("cloudinary.searchAssets");
            break;
          case "openWelcomeScreen":
            vscode.commands.executeCommand("cloudinary.openWelcomeScreen");
            break;
        }
      }
    );
  }

  private _getBodyContent(): string {
    const hasConfig = !!(this._provider.cloudName && this._provider.apiKey);
    const cloudName = escapeHtml(this._provider.cloudName || "");

    return `
      <div class="container">
        <div class="status-card">
          <div class="status-card__icon status-card__icon--${hasConfig ? "success" : "warning"}">
            ${hasConfig ? "✓" : "⚠"}
          </div>
          <div class="status-card__content">
            <div class="status-card__title">${hasConfig ? cloudName : "Not Configured"}</div>
            <p class="status-card__text">${hasConfig ? "Connected" : "Setup required"}</p>
          </div>
          ${!hasConfig
            ? `<button class="btn btn--primary btn--sm" onclick="openGlobalConfig()">Configure</button>`
            : ""}
        </div>

        <div class="btn-group btn-group--vertical" style="margin-top: 1rem; width: 100%;">
          <button class="btn btn--secondary btn--md" style="width: 100%;" onclick="showLibrary()">
            Browse Library
          </button>
          <button class="btn btn--secondary btn--md" style="width: 100%;" onclick="openUploadWidget()">
            Upload
          </button>
          <button class="btn btn--secondary btn--md" style="width: 100%;" onclick="searchAssets()">
            Search
          </button>
        </div>

        <div style="margin-top: 1.5rem; text-align: center;">
          <span class="link" onclick="openWelcomeScreen()">Welcome Guide</span>
        </div>
      </div>
    `;
  }
}
