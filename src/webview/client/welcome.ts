/**
 * Welcome Screen specific functionality.
 */

import { copyToClipboard, initCommon, getVSCode } from "./common";

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
function focusDashboard(): void {
  getVSCode()?.postMessage({ command: "focusDashboard" });
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
    focusDashboard: typeof focusDashboard;
    getConfigExample: typeof getConfigExample;
  }
}

window.openGlobalConfig = openGlobalConfig;
window.openExternal = openExternal;
window.focusDashboard = focusDashboard;
window.getConfigExample = getConfigExample;

// Initialize common functionality when this script loads
initCommon();

document.addEventListener("click", async (event) => {
  const target = (event.target as HTMLElement | null)?.closest(
    "[data-welcome-action]"
  ) as HTMLElement | null;

  if (!target) {return;}

  event.preventDefault();
  const action = target.dataset.welcomeAction;

  switch (action) {
    case "openGlobalConfig":
      openGlobalConfig();
      break;
    case "focusDashboard":
      focusDashboard();
      break;
    case "openExternal":
      if (target.dataset.url) {
        openExternal(target.dataset.url);
      }
      break;
    case "copyConfigExample":
      await copyToClipboard(getConfigExample(), target);
      break;
  }
});
