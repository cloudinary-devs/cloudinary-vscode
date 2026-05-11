/**
 * Client-side JavaScript for the Welcome Screen webview.
 * This module generates the script content to be embedded in the webview.
 */

/**
 * Returns the welcome screen client-side JavaScript.
 */
export function getWelcomeScreenScript(): string {
  return `
    function openGlobalConfig() {
      vscode.postMessage({ command: 'openGlobalConfig' });
    }

    function openExternal(url) {
      vscode.postMessage({ command: 'openExternal', data: url });
    }

    function focusDashboard() {
      vscode.postMessage({ command: 'focusDashboard' });
    }

    function getConfigExample() {
      return JSON.stringify({
        "your-cloud-name": {
          "apiKey": "your-api-key",
          "apiSecret": "your-api-secret"
        }
      }, null, 2);
    }
  `;
}
