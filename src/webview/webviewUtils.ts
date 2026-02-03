/**
 * Utilities for VS Code webview panels.
 * Provides helpers for URIs, CSP, and HTML generation.
 */

import * as vscode from "vscode";
import { escapeHtml } from "./utils/helpers";

/**
 * Generate a random nonce for CSP.
 */
export function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

/**
 * Get a webview URI for a resource.
 */
export function getWebviewUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  pathSegments: string[]
): vscode.Uri {
  return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathSegments));
}

/**
 * Media URIs for a webview.
 */
export interface WebviewMediaUris {
  tokensUri: vscode.Uri;
  baseUri: vscode.Uri;
  componentsUri: vscode.Uri;
}

/**
 * Get all media URIs for a webview.
 */
export function getMediaUris(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): WebviewMediaUris {
  return {
    tokensUri: getWebviewUri(webview, extensionUri, [
      "media", "styles", "tokens.css"
    ]),
    baseUri: getWebviewUri(webview, extensionUri, [
      "media", "styles", "base.css"
    ]),
    componentsUri: getWebviewUri(webview, extensionUri, [
      "media", "styles", "components.css"
    ]),
  };
}

/**
 * Get additional script URI.
 */
export function getScriptUri(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  scriptName: string
): vscode.Uri {
  return getWebviewUri(webview, extensionUri, [
    "media", "scripts", scriptName
  ]);
}

/**
 * Generate Content Security Policy for a webview.
 */
export function getCSP(webview: vscode.Webview, nonce: string): string {
  return [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    `img-src ${webview.cspSource} https: data:`,
    `media-src ${webview.cspSource} https:`,
    `font-src ${webview.cspSource}`,
  ].join("; ");
}

/**
 * Options for creating a webview HTML document.
 */
export interface WebviewDocumentOptions {
  title: string;
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  bodyContent: string;
  bodyClass?: string;
  additionalScripts?: vscode.Uri[];
  inlineScript?: string;
}

/**
 * Create a complete HTML document for a webview.
 */
export function createWebviewDocument(options: WebviewDocumentOptions): string {
  const {
    title,
    webview,
    extensionUri,
    bodyContent,
    bodyClass = "",
    additionalScripts = [],
    inlineScript = "",
  } = options;

  const nonce = getNonce();
  const { tokensUri, baseUri, componentsUri } = getMediaUris(webview, extensionUri);
  const csp = getCSP(webview, nonce);

  const scriptTags = additionalScripts
    .map((uri) => `<script nonce="${nonce}" src="${uri}"></script>`)
    .join("\n    ");

  const inlineScriptTag = inlineScript
    ? `<script nonce="${nonce}">${inlineScript}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${tokensUri}">
  <link rel="stylesheet" href="${baseUri}">
  <link rel="stylesheet" href="${componentsUri}">
  <title>${escapeHtml(title)}</title>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
  ${bodyContent}
  
  ${scriptTags}
  ${inlineScriptTag}
</body>
</html>`;
}

