/**
 * Welcome Screen specific functionality.
 */

import { initCommon, getVSCode } from "./common";

/**
 * Open global configuration.
 */
function openGlobalConfig(): void {
  getVSCode()?.postMessage({ command: "openGlobalConfig" });
}

/**
 * Open upload widget.
 */
function openUploadWidget(): void {
  getVSCode()?.postMessage({ command: "openUploadWidget" });
}

/**
 * Switch environment.
 */
function switchEnvironment(): void {
  getVSCode()?.postMessage({ command: "switchEnvironment" });
}

/**
 * Open external URL.
 */
function openExternal(url: string): void {
  getVSCode()?.postMessage({ command: "openExternal", data: url });
}

/**
 * Focus tree view.
 */
function focusTreeView(): void {
  getVSCode()?.postMessage({ command: "focusTreeView" });
}

/**
 * Get Cursor MCP config example.
 */
function getCursorConfig(): string {
  return JSON.stringify(
    {
      mcpServers: {
        "cloudinary-asset-mgmt": {
          command: "npx",
          args: ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
          env: {
            CLOUDINARY_CLOUD_NAME: "your-cloud-name",
            CLOUDINARY_API_KEY: "your-api-key",
            CLOUDINARY_API_SECRET: "your-api-secret",
          },
        },
      },
    },
    null,
    2
  );
}

/**
 * Get Claude Desktop MCP config example.
 */
function getClaudeConfig(): string {
  return JSON.stringify(
    {
      mcpServers: {
        "cloudinary-asset-mgmt": {
          command: "npx",
          args: ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
          env: {
            CLOUDINARY_CLOUD_NAME: "your-cloud-name",
            CLOUDINARY_API_KEY: "your-api-key",
            CLOUDINARY_API_SECRET: "your-api-secret",
          },
        },
      },
    },
    null,
    2
  );
}

/**
 * Get VS Code MCP config example.
 */
function getVSCodeConfig(): string {
  return JSON.stringify(
    {
      mcp: {
        servers: {
          "cloudinary-asset-mgmt": {
            type: "stdio",
            command: "npx",
            args: ["-y", "--package", "@cloudinary/asset-management", "--", "mcp", "start"],
            env: {
              CLOUDINARY_CLOUD_NAME: "your-cloud-name",
              CLOUDINARY_API_KEY: "your-api-key",
              CLOUDINARY_API_SECRET: "your-api-secret",
            },
          },
        },
      },
    },
    null,
    2
  );
}

/**
 * Get environments.json config example.
 */
function getConfigExample(): string {
  return JSON.stringify(
    {
      "your-cloud-name": {
        apiKey: "your-api-key",
        apiSecret: "your-api-secret",
      },
    },
    null,
    2
  );
}

// Export to window for inline script access
declare global {
  interface Window {
    openGlobalConfig: typeof openGlobalConfig;
    openUploadWidget: typeof openUploadWidget;
    switchEnvironment: typeof switchEnvironment;
    openExternal: typeof openExternal;
    focusTreeView: typeof focusTreeView;
    getCursorConfig: typeof getCursorConfig;
    getClaudeConfig: typeof getClaudeConfig;
    getVSCodeConfig: typeof getVSCodeConfig;
    getConfigExample: typeof getConfigExample;
  }
}

window.openGlobalConfig = openGlobalConfig;
window.openUploadWidget = openUploadWidget;
window.switchEnvironment = switchEnvironment;
window.openExternal = openExternal;
window.focusTreeView = focusTreeView;
window.getCursorConfig = getCursorConfig;
window.getClaudeConfig = getClaudeConfig;
window.getVSCodeConfig = getVSCodeConfig;
window.getConfigExample = getConfigExample;

// Initialize common functionality when this script loads
initCommon();
