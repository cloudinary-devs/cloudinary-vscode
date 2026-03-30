/**
 * Homescreen webview client-side script.
 * Handles button actions by posting messages to the extension host.
 */

import { initCommon, getVSCode } from "./common";

function openGlobalConfig(): void {
  getVSCode()?.postMessage({ command: "openGlobalConfig" });
}

function showLibrary(): void {
  getVSCode()?.postMessage({ command: "showLibrary" });
}

function openUploadWidget(): void {
  getVSCode()?.postMessage({ command: "openUploadWidget" });
}

function searchAssets(): void {
  getVSCode()?.postMessage({ command: "searchAssets" });
}

function openWelcomeScreen(): void {
  getVSCode()?.postMessage({ command: "openWelcomeScreen" });
}

declare global {
  interface Window {
    openGlobalConfig: typeof openGlobalConfig;
    showLibrary: typeof showLibrary;
    openUploadWidget: typeof openUploadWidget;
    searchAssets: typeof searchAssets;
    openWelcomeScreen: typeof openWelcomeScreen;
  }
}

window.openGlobalConfig = openGlobalConfig;
window.showLibrary = showLibrary;
window.openUploadWidget = openUploadWidget;
window.searchAssets = searchAssets;
window.openWelcomeScreen = openWelcomeScreen;

initCommon();
