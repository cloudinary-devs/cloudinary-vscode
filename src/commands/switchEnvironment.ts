import * as vscode from "vscode";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryService, Credentials } from "../cloudinary/cloudinaryService";
import { loadEnvironments, getGlobalConfigPath } from "../config/configUtils";
import { detectFolderModeResult, resolveFolderModeState } from "../config/detectFolderMode";
import { readFolderModeCache, writeFolderModeCache } from "../config/folderModeCache";
import { generateUserAgent } from "../utils/userAgent";
import { AnalyticsService } from "../analytics/analyticsService";
import { trackConfigValidation } from "../analytics/trackConfigValidation";

interface CloudinaryEnvironment {
  apiKey: string;
  apiSecret: string;
  uploadPreset?: string;  // Optional: Default upload preset
}

type EnvironmentTarget = Pick<
  CloudinaryService,
  "cloudName" | "apiKey" | "apiSecret" | "uploadPreset" | "dynamicFolders" | "credentialsValid"
> & {
  setCredentials?: (creds: Credentials) => void;
};

function updateEnvironmentTarget(
  target: EnvironmentTarget,
  credentials: Credentials
) {
  if (typeof target.setCredentials === "function") {
    target.setCredentials(credentials);
    return;
  }

  target.cloudName = credentials.cloudName;
  target.apiKey = credentials.apiKey;
  target.apiSecret = credentials.apiSecret;
  target.uploadPreset = credentials.uploadPreset ?? null;
  target.dynamicFolders = credentials.dynamicFolders ?? false;
}

function getStatusBarText(cloudName: string, dynamicFolders: boolean): string {
  const folderMode = dynamicFolders ? "Dynamic" : "Fixed";
  return `$(cloud) ${cloudName} $(folder) ${folderMode}`;
}

function getStatusBarTooltip(dynamicFolders: boolean): string {
  return dynamicFolders
    ? "Click to switch Cloudinary environment\n\nDynamic Folders: Assets can be organized independently of their public ID"
    : "Click to switch Cloudinary environment\n\nFixed Folders: Asset folder is determined by public ID path";
}

/**
 * Registers commands for switching Cloudinary environments and editing global config.
 * @param context - Extension context (includes global state).
 * @param target - Cloudinary environment target to update credentials on.
 * @param statusBar - VS Code status bar item to reflect environment change.
 */
function registerSwitchEnv(
  context: vscode.ExtensionContext,
  target: EnvironmentTarget,
  statusBar: vscode.StatusBarItem,
  analytics?: AnalyticsService
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.switchEnvironment",
      async () => {
        const environments = await loadEnvironments();
        const cloudNames = Object.keys(environments);

        if (cloudNames.length === 0) {
          vscode.window.showErrorMessage("No Cloudinary environments found in config.");
          return;
        }

        const selected = await vscode.window.showQuickPick(cloudNames, {
          placeHolder: "Select a Cloudinary environment",
        });

        if (selected) {
          const env = environments[selected];
          const cached = readFolderModeCache(context.globalState, selected);

          // Always validate the current credentials. The folder-mode cache is
          // keyed only by cloud name, so it can provide a fallback mode but
          // cannot prove that the current API key/secret are valid.
          const result = await detectFolderModeResult(
            selected,
            env.apiKey,
            env.apiSecret
          );
          trackConfigValidation(analytics, result, "switch");

          if (result.outcome === "success") {
            await writeFolderModeCache(context.globalState, selected, result.dynamicFolders);
          }
          const { dynamicFolders, credentialsValid } = resolveFolderModeState(result, cached);

          updateEnvironmentTarget(target, {
            cloudName: selected,
            apiKey: env.apiKey,
            apiSecret: env.apiSecret,
            uploadPreset: env.uploadPreset || null,
            dynamicFolders,
          });
          target.credentialsValid = credentialsValid;

          (cloudinary.utils as any).userPlatform = generateUserAgent();

          cloudinary.config({
            cloud_name: selected,
            api_key: env.apiKey,
            api_secret: env.apiSecret,
          });

          statusBar.text = getStatusBarText(selected, dynamicFolders);
          statusBar.tooltip = getStatusBarTooltip(dynamicFolders);

          vscode.window.showInformationMessage(
            `$(cloud) Switched to ${selected} environment.`
          );
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openGlobalConfig", async () => {
      const envPath = getGlobalConfigPath();
      const doc = await vscode.workspace.openTextDocument(envPath);
      vscode.window.showTextDocument(doc);
    })
  );
}

export default registerSwitchEnv;
