import * as vscode from "vscode";
import registerSearch from "./searchAssets";
import registerFilter from "./setResourceFilter";
import registerSortOrder from "./setSortOrder";
import registerPreview from "./previewAsset";
import registerUpload from "./uploadWidget";
import registerClipboard from "./copyCommands";
import registerSwitchEnv from "./switchEnvironment";
import registerClearSearch from "./clearSearch";
import registerWelcomeScreen from "./welcomeScreen";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

/**
 * Registers all Cloudinary-related commands with the VS Code command registry.
 * @param context - The extension context.
 * @param provider - The Cloudinary tree data provider.
 * @param statusBar - Status bar item to show current environment.
 */
function registerAllCommands(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider,
  statusBar: vscode.StatusBarItem
) {
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

  registerSearch(context, provider);
  registerClearSearch(context, provider);
  registerFilter(context, provider);
  registerSortOrder(context, provider);
  registerPreview(context);
  registerUpload(context, provider);
  registerClipboard(context);
  registerSwitchEnv(context, provider, statusBar);
  registerWelcomeScreen(context, provider);
}

export { registerAllCommands };
