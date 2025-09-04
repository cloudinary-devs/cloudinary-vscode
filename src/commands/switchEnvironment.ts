import * as vscode from "vscode";
import { v2 as cloudinary } from "cloudinary";
import { loadEnvironments, getGlobalConfigPath } from "../config/configUtils";
import detectFolderMode from "../config/detectFolderMode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import { generateUserAgent } from "../utils/userAgent";

interface CloudinaryEnvironment {
  apiKey: string;
  apiSecret: string;
  uploadPreset: string;
}

/**
 * Registers commands for switching Cloudinary environments and editing global config.
 * @param context - Extension context (includes global state).
 * @param provider - Cloudinary data provider to update credentials.
 * @param statusBar - VS Code status bar item to reflect environment change.
 */
function registerSwitchEnv(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider,
  statusBar: vscode.StatusBarItem
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.switchEnvironment",
      async () => {
        const environments = await loadEnvironments();
        const cloudNames = Object.keys(environments);

        if (cloudNames.length === 0) {
          vscode.window.showErrorMessage("❌ No Cloudinary environments found in config.");
          return;
        }

        const selected = await vscode.window.showQuickPick(cloudNames, {
          placeHolder: "Select a Cloudinary environment",
        });

        if (selected) {
          const env = environments[selected];

          provider.cloudName = selected;
          provider.apiKey = env.apiKey;
          provider.apiSecret = env.apiSecret;
          provider.uploadPreset = env.uploadPreset;

          const cacheKey = `cloudinary.dynamicFolders.${selected}`;
          const cachedFolderMode = context.globalState.get(cacheKey) as boolean | undefined;

          if (typeof cachedFolderMode === "boolean") {
            provider.dynamicFolders = cachedFolderMode;
          } else {
            provider.dynamicFolders = await detectFolderMode(
              selected,
              env.apiKey,
              env.apiSecret
            );
            context.globalState.update(cacheKey, provider.dynamicFolders);
          }

          (cloudinary.utils as any).userPlatform = generateUserAgent();

          cloudinary.config({
            cloud_name: selected,
            api_key: env.apiKey,
            api_secret: env.apiSecret,
          });

          statusBar.text = `$(cloud) ${selected}`;
          provider.refresh({
            folderPath: '',
            nextCursor: null,
            searchQuery: null,
            resourceTypeFilter: 'all'
          });

          vscode.window.showInformationMessage(
            `🔄 Switched to ${selected} environment.`
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
