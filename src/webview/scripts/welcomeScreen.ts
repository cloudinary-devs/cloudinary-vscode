/**
 * Client-side JavaScript for the Welcome Screen webview.
 * This module generates the script content to be embedded in the webview.
 */

/**
 * Returns the welcome screen client-side JavaScript.
 */
export function getWelcomeScreenScript(): string {
  return `
    // ========================================
    // Command Functions
    // ========================================

    function openGlobalConfig() {
      vscode.postMessage({ command: 'openGlobalConfig' });
    }

    function openUploadWidget() {
      vscode.postMessage({ command: 'openUploadWidget' });
    }

    function switchEnvironment() {
      vscode.postMessage({ command: 'switchEnvironment' });
    }

    function copyToClipboard(text) {
      vscode.postMessage({ command: 'copyToClipboard', data: text });
    }

    function openExternal(url) {
      vscode.postMessage({ command: 'openExternal', data: url });
    }

    function focusTreeView() {
      vscode.postMessage({ command: 'focusTreeView' });
    }

    // ========================================
    // Configuration Generators
    // ========================================

    function getCursorConfig() {
      return JSON.stringify({
        "mcpServers": {
          "cloudinary-asset-mgmt": {
            "command": "npx",
            "args": ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
            "env": {
              "CLOUDINARY_CLOUD_NAME": "your-cloud-name",
              "CLOUDINARY_API_KEY": "your-api-key",
              "CLOUDINARY_API_SECRET": "your-api-secret"
            }
          }
        }
      }, null, 2);
    }

    function getClaudeConfig() {
      return JSON.stringify({
        "mcpServers": {
          "cloudinary-asset-mgmt": {
            "command": "npx",
            "args": ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
            "env": {
              "CLOUDINARY_CLOUD_NAME": "your-cloud-name",
              "CLOUDINARY_API_KEY": "your-api-key",
              "CLOUDINARY_API_SECRET": "your-api-secret"
            }
          }
        }
      }, null, 2);
    }

    function getVSCodeConfig() {
      return JSON.stringify({
        "mcp": {
          "servers": {
            "cloudinary-asset-mgmt": {
              "type": "stdio",
              "command": "npx",
              "args": ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
              "env": {
                "CLOUDINARY_CLOUD_NAME": "your-cloud-name",
                "CLOUDINARY_API_KEY": "your-api-key",
                "CLOUDINARY_API_SECRET": "your-api-secret"
              }
            }
          }
        }
      }, null, 2);
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
