import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  getGlobalConfigPath,
  hasCompleteEnvironment,
  loadEnvironments,
  CloudinaryEnvironment,
  isPlaceholderConfig,
} from "./config/configUtils";
import { detectFolderModeResult, resolveFolderModeState } from "./config/detectFolderMode";
import {
  readFolderModeCache,
  writeFolderModeCache,
} from "./config/folderModeCache";
import { trackConfigValidation } from "./analytics/trackConfigValidation";
import { registerAllCommands } from "./commands/registerCommands";
import { CloudinaryService, Credentials } from "./cloudinary/cloudinaryService";
import { createCloudinarySdkAdapter } from "./cloudinary/cloudinarySdkAdapter";
import { v2 as cloudinary } from "cloudinary";
import packageJson from "../package.json";
import { AnalyticsService } from "./analytics/analyticsService";
import { generateUserAgent } from "./utils/userAgent";
import { HomescreenViewProvider } from "./webview/homescreenView";
import { LibraryWebviewViewProvider } from "./webview/libraryView";
import { DocsAiViewProvider } from "./webview/docsAiView";
import { resetUploadPanel } from "./commands/uploadWidget";
import { resetAllPreviewPanels } from "./commands/previewAsset";
import { detectEditorPlatform } from "./aiToolsService";
import { refreshWelcomePanel } from "./commands/welcomeScreen";

let statusBar: vscode.StatusBarItem;

/**
 * Returns the status bar text with cloud name and folder mode indicator.
 */
function getStatusBarText(
  cloudName: string,
  dynamicFolders: boolean,
  credentialsValid?: boolean
): string {
  // Rejected credentials: warn and drop the folder-mode chip (it isn't trustworthy).
  if (credentialsValid === false) {
    return `$(warning) ${cloudName}: credentials invalid`;
  }
  // Not yet validated (or unverifiable, e.g. offline): show the cloud without
  // asserting a folder mode we haven't confirmed.
  if (credentialsValid === undefined) {
    return `$(cloud) ${cloudName}`;
  }
  const folderMode = dynamicFolders ? "Dynamic" : "Fixed";
  return `$(cloud) ${cloudName} $(folder) ${folderMode}`;
}

/**
 * Returns the status bar tooltip with folder mode explanation.
 */
function getStatusBarTooltip(dynamicFolders: boolean, credentialsValid?: boolean): string {
  if (credentialsValid === false) {
    return "Cloudinary credentials are invalid or unauthorized.\n\nClick to switch environment, or update your config.";
  }
  if (credentialsValid === undefined) {
    return "Click to switch Cloudinary environment";
  }
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
  const analytics = new AnalyticsService({
    extensionVersion: packageJson.version,
    storage: context.globalState,
    getCloudName: () => cloudinaryService.cloudName,
    getDebugId: () => process.env.CLOUDINARY_ANALYTICS_DEBUG_ID,
    getIdePlatform: detectEditorPlatform,
  });
  analytics.track("extension_activated");

  // Set initial view to homescreen
  vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");

  const libraryWebviewProvider = new LibraryWebviewViewProvider(
    context.extensionUri,
    cloudinaryService,
    analytics
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
    context.globalState,
    libraryWebviewProvider,
    analytics
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HomescreenViewProvider.viewType,
      homescreenProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  const docsAiProvider = new DocsAiViewProvider(
    context.extensionUri,
    context.globalState,
    analytics,
    (recentConversations) => homescreenProvider.setDocsAiRecentConversations(recentConversations)
  );
  homescreenProvider.setDocsAiRecentConversationsRefresh(() => docsAiProvider.requestRecentConversations());
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DocsAiViewProvider.viewType,
      docsAiProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
    vscode.commands.registerCommand("cloudinary.docsAi.refresh", () => {
      docsAiProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("cloudinary.docsAi.apiBase")) {
        docsAiProvider.refresh();
      }
    })
  );

  const refreshEnvironmentViews = async (): Promise<void> => {
    homescreenProvider.refresh();
    refreshWelcomePanel();
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
    apiSecret: string,
    entryPoint: string,
    options: { force?: boolean } = {}
  ): Promise<{ dynamicFolders: boolean; credentialsValid: boolean | undefined }> => {
    // Cached entry (any age). Legacy plain-boolean entries are ignored so
    // installs stuck on an outdated mode re-validate and self-heal.
    const cached = readFolderModeCache(context.globalState, cloudName);

    // Fresh validation: exercise the current credentials and report success/error
    // once. A folder-mode cache is keyed only by cloud name, so it can provide a
    // last-known folder mode but must never certify that the current API key and
    // secret are valid.
    const result = await detectFolderModeResult(cloudName, apiKey, apiSecret);
    trackConfigValidation(analytics, result, entryPoint);

    if (result.outcome === "success") {
      await writeFolderModeCache(context.globalState, cloudName, result.dynamicFolders);
    }
    return resolveFolderModeState(result, cached);
  };

  const environmentTarget: Pick<
    CloudinaryService,
    "cloudName" | "apiKey" | "apiSecret" | "uploadPreset" | "dynamicFolders" | "credentialsValid"
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
    get credentialsValid() {
      return cloudinaryService.credentialsValid;
    },
    set credentialsValid(value: boolean | undefined) {
      cloudinaryService.credentialsValid = value;
    },
    setCredentials(creds: Credentials) {
      cloudinaryService.setCredentials(creds);
      if (creds.cloudName && creds.apiKey && creds.apiSecret) {
        updateCloudinaryConfig(creds.cloudName, creds.apiKey, creds.apiSecret);
      }
      void refreshEnvironmentViews();
    },
  };

  // Check if this is the first run of the extension
  const isFirstRun = context.globalState.get('cloudinary.firstRun', true);

  const openWelcomeOnFirstRun = async (): Promise<void> => {
    if (!isFirstRun) {
      return;
    }
    await context.globalState.update('cloudinary.firstRun', false);
    await vscode.commands.executeCommand("cloudinary.openWelcomeScreen");
  };

  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    500
  );
  statusBar.text = `$(warning) Cloudinary: Not Configured`;
  statusBar.tooltip = "Click to configure Cloudinary credentials";
  statusBar.command = "cloudinary.openGlobalConfig";
  statusBar.show();
  context.subscriptions.push(statusBar);

  const markNotConfigured = async (): Promise<void> => {
    cloudinaryService.setCredentials({
      cloudName: null,
      apiKey: null,
      apiSecret: null,
      uploadPreset: null,
      dynamicFolders: false,
    });
    cloudinaryService.credentialsValid = undefined;
    statusBar.text = `$(warning) Cloudinary: Not Configured`;
    statusBar.tooltip = "Click to configure Cloudinary credentials";
    statusBar.command = "cloudinary.openGlobalConfig";
    await refreshEnvironmentViews();
  };

  const applyEnvironment = async (
    cloudName: string,
    env: CloudinaryEnvironment,
    entryPoint: string
  ): Promise<void> => {
    const { dynamicFolders, credentialsValid } = await resolveDynamicFolders(
      cloudName,
      env.apiKey,
      env.apiSecret,
      entryPoint
    );
    cloudinaryService.setCredentials({
      cloudName,
      apiKey: env.apiKey,
      apiSecret: env.apiSecret,
      uploadPreset: env.uploadPreset || null,
      dynamicFolders,
    });
    cloudinaryService.credentialsValid = credentialsValid;
    updateCloudinaryConfig(cloudName, env.apiKey, env.apiSecret);

    statusBar.text = getStatusBarText(cloudName, dynamicFolders, credentialsValid);
    statusBar.tooltip = getStatusBarTooltip(dynamicFolders, credentialsValid);
    statusBar.command = "cloudinary.switchEnvironment";

    await refreshEnvironmentViews();
  };

  registerAllCommands(
    context,
    cloudinaryService,
    environmentTarget,
    statusBar,
    homescreenProvider,
    libraryWebviewProvider,
    docsAiProvider,
    analytics
  );

  const refreshFromConfigFile = async (): Promise<void> => {
    const updatedEnvs = await loadEnvironments();
    const cloudNames = Object.keys(updatedEnvs);

    if (cloudNames.length === 0) {
      await markNotConfigured();
      return;
    }

    // Try to keep the previously active cloud name
    const preferredCloud = cloudinaryService.cloudName;
    const newCloudName = preferredCloud && cloudNames.includes(preferredCloud)
      ? preferredCloud
      : cloudNames[0];

    const env = updatedEnvs[newCloudName];

    if (
      !hasCompleteEnvironment(newCloudName, env) ||
      isPlaceholderConfig(newCloudName, env.apiKey, env.apiSecret)
    ) {
      await markNotConfigured();
      return;
    }

    // The credentials file just changed; the keys (or the account's folder mode)
    // may differ from what we cached, so force a fresh detection. This also
    // re-validates the credentials so the status reflects whether they work.
    await applyEnvironment(newCloudName, env, "config_change");
  };

  let configReloadTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleConfigReload = (): void => {
    if (configReloadTimer) {
      clearTimeout(configReloadTimer);
    }
    configReloadTimer = setTimeout(() => {
      configReloadTimer = undefined;
      void refreshFromConfigFile();
    }, 250);
  };
  context.subscriptions.push({
    dispose: () => {
      if (configReloadTimer) {
        clearTimeout(configReloadTimer);
        configReloadTimer = undefined;
      }
    },
  });

  // Reload config if the global file changes. VS Code's watcher can report
  // editor saves as create/delete events, so all event types feed the same
  // debounced refresh.
  const globalConfigPath = getGlobalConfigPath();
  const globalConfigDir = path.dirname(globalConfigPath);
  const globalConfigFileName = path.basename(globalConfigPath);
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(
      globalConfigDir,
      globalConfigFileName
    )
  );

  watcher.onDidChange(scheduleConfigReload);
  watcher.onDidCreate(scheduleConfigReload);
  watcher.onDidDelete(scheduleConfigReload);

  context.subscriptions.push(watcher);

  try {
    const nodeWatcher = fs.watch(globalConfigDir, (_eventType, fileName) => {
      if (fileName && fileName.toString() === globalConfigFileName) {
        scheduleConfigReload();
      }
    });
    context.subscriptions.push({ dispose: () => nodeWatcher.close() });
  } catch {
    // The VS Code watcher above is the primary path; this is only a fallback.
  }

  // Manual escape hatch: force a fresh folder-mode detection. Useful after an
  // account is migrated between fixed and dynamic folders, or to recover an
  // install that cached the wrong mode.
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.refreshFolderMode", async () => {
      const { cloudName, apiKey, apiSecret } = cloudinaryService;
      if (!cloudName || !apiKey || !apiSecret || isPlaceholderConfig(cloudName, apiKey, apiSecret)) {
        vscode.window.showWarningMessage(
          "Configure Cloudinary credentials before refreshing the folder mode."
        );
        return;
      }

      const result = await detectFolderModeResult(cloudName, apiKey, apiSecret);
      trackConfigValidation(analytics, result, "manual_refresh");

      if (result.outcome !== "success") {
        // Reflect rejected credentials in the status; leave a transient (e.g.
        // network) failure as-is so we don't falsely mark working creds invalid.
        if (result.errorReason === "unauthorized") {
          cloudinaryService.credentialsValid = false;
          statusBar.text = getStatusBarText(cloudName, cloudinaryService.dynamicFolders, false);
          statusBar.tooltip = getStatusBarTooltip(cloudinaryService.dynamicFolders, false);
          await refreshEnvironmentViews();
        }
        vscode.window.showWarningMessage(
          "Could not refresh the Cloudinary folder mode. Check your credentials or connection, then try again."
        );
        return;
      }

      const dynamicFolders = result.dynamicFolders;
      await writeFolderModeCache(context.globalState, cloudName, dynamicFolders);
      cloudinaryService.dynamicFolders = dynamicFolders;
      cloudinaryService.credentialsValid = true;

      statusBar.text = getStatusBarText(cloudName, dynamicFolders, true);
      statusBar.tooltip = getStatusBarTooltip(dynamicFolders, true);

      await refreshEnvironmentViews();
      vscode.window.showInformationMessage(
        `Cloudinary folder mode: ${dynamicFolders ? "Dynamic" : "Fixed"} folders.`
      );
    })
  );

  const environments = await loadEnvironments();
  const firstCloudName = Object.keys(environments)[0];
  const selectedEnv = environments[firstCloudName];

  if (
    !hasCompleteEnvironment(firstCloudName, selectedEnv) ||
    isPlaceholderConfig(firstCloudName, selectedEnv.apiKey, selectedEnv.apiSecret)
  ) {
    await markNotConfigured();
    await openWelcomeOnFirstRun();
    return;
  }

  await applyEnvironment(firstCloudName, selectedEnv, "activation");
  await openWelcomeOnFirstRun();
}

/**
 * Optional cleanup on extension deactivation.
 */
export function deactivate() { }
