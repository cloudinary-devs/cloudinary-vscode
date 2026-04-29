import * as vscode from "vscode";
import * as path from "path";
import {
  getGlobalConfigPath,
  loadEnvironments,
  CloudinaryEnvironment,
  isPlaceholderConfig,
} from "./config/configUtils";
import detectFolderMode from "./config/detectFolderMode";
import { registerAllCommands } from "./commands/registerCommands";
import { CloudinaryService, Credentials } from "./cloudinary/cloudinaryService";
import { createCloudinarySdkAdapter } from "./cloudinary/cloudinarySdkAdapter";
import { v2 as cloudinary } from "cloudinary";
import { generateUserAgent } from "./utils/userAgent";
import { HomescreenViewProvider } from "./webview/homescreenView";
import { LibraryWebviewViewProvider } from "./webview/libraryView";
import { resetUploadPanel } from "./commands/uploadWidget";
import { resetAllPreviewPanels } from "./commands/previewAsset";

let statusBar: vscode.StatusBarItem;

/**
 * Returns the status bar text with cloud name and folder mode indicator.
 */
function getStatusBarText(cloudName: string, dynamicFolders: boolean): string {
  const folderMode = dynamicFolders ? "Dynamic" : "Fixed";
  return `$(cloud) ${cloudName} $(folder) ${folderMode}`;
}

/**
 * Returns the status bar tooltip with folder mode explanation.
 */
function getStatusBarTooltip(dynamicFolders: boolean): string {
  const modeDescription = dynamicFolders
    ? "Dynamic Folders: Assets can be organized independently of their public ID"
    : "Fixed Folders: Asset folder is determined by public ID path";
  return `Click to switch Cloudinary environment\n\n${modeDescription}`;
}

/**
 * Called by VS Code on extension activation. Sets up provider, status bar, and commands.
 * @param context - Extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext) {
  const cloudinaryService = new CloudinaryService(createCloudinarySdkAdapter());

  // Set initial view to homescreen
  vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");

  const libraryWebviewProvider = new LibraryWebviewViewProvider(
    context.extensionUri,
    cloudinaryService
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      LibraryWebviewViewProvider.viewType,
      libraryWebviewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Register homescreen sidebar view
  const homescreenProvider = new HomescreenViewProvider(
    context.extensionUri,
    cloudinaryService,
    libraryWebviewProvider
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HomescreenViewProvider.viewType,
      homescreenProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  const refreshEnvironmentViews = async (): Promise<void> => {
    homescreenProvider.refresh();
    resetUploadPanel();
    resetAllPreviewPanels();
    await libraryWebviewProvider.envChanged();
  };

  const updateCloudinaryConfig = (
    cloudName: string,
    apiKey: string,
    apiSecret: string
  ): void => {
    (cloudinary.utils as any).userPlatform = generateUserAgent();
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  };

  const resolveDynamicFolders = async (
    cloudName: string,
    apiKey: string,
    apiSecret: string
  ): Promise<boolean> => {
    const cacheKey = `cloudinary.dynamicFolders.${cloudName}`;
    const cachedFolderMode = context.globalState.get(cacheKey) as boolean | undefined;

    if (typeof cachedFolderMode === "boolean") {
      return cachedFolderMode;
    }

    const dynamicFolders = await detectFolderMode(cloudName, apiKey, apiSecret);
    await context.globalState.update(cacheKey, dynamicFolders);
    return dynamicFolders;
  };

  const environmentTarget: Pick<
    CloudinaryService,
    "cloudName" | "apiKey" | "apiSecret" | "uploadPreset" | "dynamicFolders"
  > & {
    setCredentials: (creds: Credentials) => void;
  } = {
    get cloudName() {
      return cloudinaryService.cloudName;
    },
    set cloudName(value: string | null) {
      cloudinaryService.cloudName = value;
    },
    get apiKey() {
      return cloudinaryService.apiKey;
    },
    set apiKey(value: string | null) {
      cloudinaryService.apiKey = value;
    },
    get apiSecret() {
      return cloudinaryService.apiSecret;
    },
    set apiSecret(value: string | null) {
      cloudinaryService.apiSecret = value;
    },
    get uploadPreset() {
      return cloudinaryService.uploadPreset;
    },
    set uploadPreset(value: string | null) {
      cloudinaryService.uploadPreset = value;
    },
    get dynamicFolders() {
      return cloudinaryService.dynamicFolders;
    },
    set dynamicFolders(value: boolean) {
      cloudinaryService.dynamicFolders = value;
    },
    setCredentials(creds: Credentials) {
      cloudinaryService.setCredentials(creds);
      if (creds.cloudName && creds.apiKey && creds.apiSecret) {
        updateCloudinaryConfig(creds.cloudName, creds.apiKey, creds.apiSecret);
      }
      void refreshEnvironmentViews();
    },
  };

  // Set initial view to homescreen
  vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");

  // Register homescreen sidebar view
  const homescreenProvider = new HomescreenViewProvider(context.extensionUri, cloudinaryProvider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HomescreenViewProvider.viewType,
      homescreenProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Refresh all open webviews when the active environment changes.
  context.subscriptions.push(
    cloudinaryProvider.onDidChangeEnvironment(() => {
      homescreenProvider.refresh();
      resetUploadPanel();
      resetAllPreviewPanels();
    })
  );

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
      "No Cloudinary environment found in config."
    );
    return;
  }

  // Check if credentials are placeholder values
  if (isPlaceholderConfig(firstCloudName, selectedEnv.apiKey, selectedEnv.apiSecret)) {
    // Initialize status bar with placeholder indicator (no popup message to avoid scaring new users)
    statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      500
    );
    statusBar.text = `$(warning) Cloudinary: Not Configured`;
    statusBar.tooltip = "Click to configure Cloudinary credentials";
    statusBar.command = "cloudinary.openGlobalConfig";
    statusBar.show();
    context.subscriptions.push(statusBar);

    registerAllCommands(
      context,
      cloudinaryService,
      environmentTarget,
      statusBar,
      homescreenProvider,
      libraryWebviewProvider
    );
    return;
  }

  cloudinaryService.setCredentials({
    cloudName: firstCloudName,
    apiKey: selectedEnv.apiKey,
    apiSecret: selectedEnv.apiSecret,
    uploadPreset: selectedEnv.uploadPreset || null,
  });
  updateCloudinaryConfig(firstCloudName, selectedEnv.apiKey, selectedEnv.apiSecret);

  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    500
  );
  // Status bar text will be updated after folder mode detection
  statusBar.text = `$(cloud) ${cloudinaryService.cloudName}`;
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
      vscode.window.showErrorMessage("No Cloudinary environments found in updated config.");
      return;
    }

    // Try to keep the previously active cloud name
    const preferredCloud = cloudinaryService.cloudName;
    const newCloudName = cloudNames.includes(preferredCloud || '')
      ? preferredCloud
      : cloudNames[0];

    const env = updatedEnvs[newCloudName!];

    // Check if updated credentials are still placeholders
    if (isPlaceholderConfig(newCloudName!, env.apiKey, env.apiSecret)) {
      statusBar.text = `$(warning) Cloudinary: Not Configured`;
      statusBar.tooltip = "Click to configure Cloudinary credentials";
      statusBar.command = "cloudinary.openGlobalConfig";
      // Don't show message - just update status bar silently
      return;
    }

    const dynamicFolders = await resolveDynamicFolders(
      newCloudName!,
      env.apiKey,
      env.apiSecret
    );
    cloudinaryService.setCredentials({
      cloudName: newCloudName!,
      apiKey: env.apiKey,
      apiSecret: env.apiSecret,
      uploadPreset: env.uploadPreset || null,
      dynamicFolders,
    });
    updateCloudinaryConfig(newCloudName!, env.apiKey, env.apiSecret);

    // Update status bar with folder mode indicator
    statusBar.text = getStatusBarText(newCloudName!, dynamicFolders);
    statusBar.tooltip = getStatusBarTooltip(dynamicFolders);
    statusBar.command = "cloudinary.switchEnvironment";

    await refreshEnvironmentViews();
  });

  context.subscriptions.push(watcher);

  // Detect and cache folder mode
  cloudinaryService.dynamicFolders = await resolveDynamicFolders(
    cloudinaryService.cloudName!,
    cloudinaryService.apiKey!,
    cloudinaryService.apiSecret!
  );

  // Update status bar with folder mode indicator
  statusBar.text = getStatusBarText(cloudinaryService.cloudName!, cloudinaryService.dynamicFolders);
  statusBar.tooltip = getStatusBarTooltip(cloudinaryService.dynamicFolders);

  await refreshEnvironmentViews();

  registerAllCommands(
    context,
    cloudinaryService,
    environmentTarget,
    statusBar,
    homescreenProvider,
    libraryWebviewProvider
  );
}

/**
 * Optional cleanup on extension deactivation.
 */
export function deactivate() { }
