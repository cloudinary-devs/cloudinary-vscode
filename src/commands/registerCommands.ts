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
import { CloudinaryService } from "../cloudinary/cloudinaryService";
import { HomescreenViewProvider } from "../webview/homescreenView";
import { LibraryWebviewViewProvider } from "../webview/libraryView";

/**
 * Registers all Cloudinary-related commands with the VS Code command registry.
 * @param context - The extension context.
 * @param cloudinaryService - The shared Cloudinary service.
 * @param statusBar - Status bar item to show current environment.
 * @param homescreenProvider - The homescreen webview view provider.
 */
function registerAllCommands(
  context: vscode.ExtensionContext,
  cloudinaryService: CloudinaryService,
  environmentTarget: Parameters<typeof registerSwitchEnv>[1],
  statusBar: vscode.StatusBarItem,
  homescreenProvider: HomescreenViewProvider,
  libraryWebview?: LibraryWebviewViewProvider
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
    vscode.commands.registerCommand("cloudinary.refresh", async () => {
      await libraryWebview?.refresh();
    })
  );

  registerSearch(context, homescreenProvider);
  registerClearSearch(context, libraryWebview);
  registerViewOptions(context, libraryWebview);
  registerPreview(context);
  registerUpload(context, cloudinaryService);
  registerClipboard(context);
  registerSwitchEnv(context, environmentTarget, statusBar);
  registerWelcomeScreen(context, cloudinaryService);
  registerConfigureAiTools(context);
}

export { registerAllCommands };
