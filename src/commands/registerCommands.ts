import * as vscode from "vscode";
import registerSearch from "./searchAssets";
import registerViewOptions from "./viewOptions";
import registerPreview from "./previewAsset";
import registerUpload from "./uploadWidget";
import registerClipboard from "./copyCommands";
import registerSwitchEnv from "./switchEnvironment";
import registerClearSearch from "./clearSearch";
import registerWelcomeScreen from "./welcomeScreen";
import registerConfigureAiTools from "./configureAiTools";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import { HomescreenViewProvider } from "../webview/homescreenView";

/**
 * Registers all Cloudinary-related commands with the VS Code command registry.
 * @param context - The extension context.
 * @param provider - The Cloudinary tree data provider.
 * @param statusBar - Status bar item to show current environment.
 * @param homescreenProvider - The homescreen webview view provider.
 */
function registerAllCommands(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider,
  statusBar: vscode.StatusBarItem,
  homescreenProvider: HomescreenViewProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.showHomescreen", () => {
      vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.showLibrary", () => {
      vscode.commands.executeCommand("setContext", "cloudinary.activeView", "library");
      vscode.commands.executeCommand("workbench.view.extension.cloudinary");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.refresh", () =>
      provider.refresh({
        folderPath: '',
        nextCursor: null,
        searchQuery: null,
        resourceTypeFilter: 'all'
      })
    )
  );

  registerSearch(context, homescreenProvider);
  registerClearSearch(context, provider);
  registerViewOptions(context, provider);
  registerPreview(context);
  registerUpload(context, provider);
  registerClipboard(context);
  registerSwitchEnv(context, provider, statusBar);
  registerWelcomeScreen(context, provider);
  registerConfigureAiTools(context);
}

export { registerAllCommands };
