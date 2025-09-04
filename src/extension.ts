import * as vscode from "vscode";
import * as path from "path";
import {
  getGlobalConfigPath,
  loadEnvironments,
  CloudinaryEnvironment,
} from "./config/configUtils";
import detectFolderMode from "./config/detectFolderMode";
import { registerAllCommands } from "./commands/registerCommands";
import { CloudinaryTreeDataProvider } from "./tree/treeDataProvider";
import { v2 as cloudinary } from "cloudinary";
import { generateUserAgent } from "./utils/userAgent";

let statusBar: vscode.StatusBarItem;

/**
 * Called by VS Code on extension activation. Sets up provider, status bar, and commands.
 * @param context - Extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext) {
  const cloudinaryProvider = new CloudinaryTreeDataProvider();

  // Check if this is the first run of the extension
  const isFirstRun = context.globalState.get('cloudinary.firstRun', true);


  if (isFirstRun) {
    // Mark as no longer first run
    context.globalState.update('cloudinary.firstRun', false);

    // Show welcome screen automatically on first install
    vscode.commands.executeCommand("cloudinary.openWelcomeScreen");
  }

  const environments = await loadEnvironments();
  const firstCloudName = Object.keys(environments)[0];
  const selectedEnv: CloudinaryEnvironment = environments[firstCloudName];

  if (!selectedEnv) {
    vscode.window.showErrorMessage(
      "❌ No Cloudinary environment found in config."
    );
    return;
  }

  cloudinaryProvider.cloudName = firstCloudName;
  cloudinaryProvider.apiKey = selectedEnv.apiKey;
  cloudinaryProvider.apiSecret = selectedEnv.apiSecret;
  cloudinaryProvider.uploadPreset = selectedEnv.uploadPreset;

  // Set user platform for analytics
  (cloudinary.utils as any).userPlatform = generateUserAgent();

  cloudinary.config({
    cloud_name: firstCloudName,
    api_key: selectedEnv.apiKey,
    api_secret: selectedEnv.apiSecret,
  });

  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    500
  );
  statusBar.text = `$(cloud) ${cloudinaryProvider.cloudName}`;
  statusBar.tooltip = "Click to switch Cloudinary environment";
  statusBar.command = "cloudinary.switchEnvironment";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Reload config if file changes
  const globalConfigPath = getGlobalConfigPath();
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(
      path.dirname(globalConfigPath),
      path.basename(globalConfigPath)
    )
  );

  watcher.onDidChange(async () => {
    const updatedEnvs = await loadEnvironments();
    const cloudNames = Object.keys(updatedEnvs);

    if (cloudNames.length === 0) {
      vscode.window.showErrorMessage("❌ No Cloudinary environments found in updated config.");
      return;
    }

    // Try to keep the previously active cloud name
    const preferredCloud = cloudinaryProvider.cloudName;
    const newCloudName = cloudNames.includes(preferredCloud || '')
      ? preferredCloud
      : cloudNames[0];

    const env = updatedEnvs[newCloudName!];

    cloudinaryProvider.cloudName = newCloudName;
    cloudinaryProvider.apiKey = env.apiKey;
    cloudinaryProvider.apiSecret = env.apiSecret;
    cloudinaryProvider.uploadPreset = env.uploadPreset;

    statusBar.text = `$(cloud) ${newCloudName}`;

    // Update user platform for analytics
    (cloudinary.utils as any).userPlatform = generateUserAgent();

    cloudinary.config({
      cloud_name: newCloudName!,
      api_key: env.apiKey,
      api_secret: env.apiSecret,
    });

    const cacheKey = `cloudinary.dynamicFolders.${newCloudName}`;
    const cachedFolderMode = context.globalState.get(cacheKey) as boolean | undefined;

    if (typeof cachedFolderMode === "boolean") {
      cloudinaryProvider.dynamicFolders = cachedFolderMode;
    } else {
      cloudinaryProvider.dynamicFolders = await detectFolderMode(
        newCloudName!,
        env.apiKey,
        env.apiSecret
      );
      context.globalState.update(cacheKey, cloudinaryProvider.dynamicFolders);
    }

    cloudinaryProvider.refresh({
      folderPath: '',
      nextCursor: null,
      searchQuery: null,
      resourceTypeFilter: 'all'
    });
  });

  context.subscriptions.push(watcher);

  // Detect and cache folder mode
  const cacheKey = `cloudinary.dynamicFolders.${cloudinaryProvider.cloudName}`;
  const cachedFolderMode = context.globalState.get(cacheKey) as boolean | undefined;

  if (typeof cachedFolderMode === "boolean") {
    cloudinaryProvider.dynamicFolders = cachedFolderMode;
  } else {
    cloudinaryProvider.dynamicFolders = await detectFolderMode(
      cloudinaryProvider.cloudName,
      cloudinaryProvider.apiKey,
      cloudinaryProvider.apiSecret
    );
    context.globalState.update(cacheKey, cloudinaryProvider.dynamicFolders);
  }

  vscode.window.registerTreeDataProvider(
    "cloudinaryMediaLibrary",
    cloudinaryProvider
  );
  registerAllCommands(context, cloudinaryProvider, statusBar);
}

/**
 * Optional cleanup on extension deactivation.
 */
export function deactivate() { }
