/**
 * Homescreen webview client-side script.
 * Wires up button event listeners and posts messages to the extension host.
 */

import { initCommon, getVSCode } from "./common";

function postMessage(command: string): void {
  getVSCode()?.postMessage({ command });
}

initCommon();

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("hs-btn-configure")?.addEventListener("click", () => postMessage("openGlobalConfig"));
  document.getElementById("hs-btn-library")?.addEventListener("click", () => postMessage("showLibrary"));
  document.getElementById("hs-btn-upload")?.addEventListener("click", () => postMessage("openUploadWidget"));
  document.getElementById("hs-btn-search")?.addEventListener("click", () => postMessage("searchAssets"));
  document.getElementById("hs-link-welcome")?.addEventListener("click", () => postMessage("openWelcomeScreen"));
});
