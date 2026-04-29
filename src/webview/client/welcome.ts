/**
 * Welcome Screen specific functionality.
 */

import { initCommon, getVSCode } from "./common";

/**
 * Open global configuration file.
 */
function openGlobalConfig(): void {
  getVSCode()?.postMessage({ command: "openGlobalConfig" });
}

/**
 * Open external URL in the default browser.
 */
function openExternal(url: string): void {
  getVSCode()?.postMessage({ command: "openExternal", data: url });
}

/**
 * Focus the Cloudinary sidebar (opens the dashboard).
 */
function focusTreeView(): void {
  getVSCode()?.postMessage({ command: "focusTreeView" });
}

/**
 * Returns the environments.json config example for copying.
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
    openExternal: typeof openExternal;
    focusTreeView: typeof focusTreeView;
    getConfigExample: typeof getConfigExample;
  }
}

window.openGlobalConfig = openGlobalConfig;
window.openExternal = openExternal;
window.focusTreeView = focusTreeView;
window.getConfigExample = getConfigExample;

// Initialize common functionality when this script loads
initCommon();
