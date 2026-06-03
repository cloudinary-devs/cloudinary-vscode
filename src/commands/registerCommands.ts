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
import { DocsAiViewProvider } from "../webview/docsAiView";
import { AnalyticsService } from "../analytics/analyticsService";

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
  libraryWebview: LibraryWebviewViewProvider,
  docsAiProvider: DocsAiViewProvider,
  analytics?: AnalyticsService
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.showHomescreen", () => {
      analytics?.track("home_opened", { entry_point: "command" });
      docsAiProvider.requestRecentConversations();
      vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");
      vscode.commands.executeCommand("workbench.view.extension.cloudinary");
      setTimeout(() => {
        void homescreenProvider.refresh();
      }, 150);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.showLibrary", () => {
      analytics?.track("library_opened", { entry_point: "command" });
      vscode.commands.executeCommand("setContext", "cloudinary.activeView", "library");
      vscode.commands.executeCommand("workbench.view.extension.cloudinary");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.showDocsAI", (initialPrompt?: string) => {
      analytics?.track("docs_ai_opened", {
        entry_point: "command",
        has_initial_prompt: !!initialPrompt,
      });
      docsAiProvider.queuePrompt(initialPrompt);
      vscode.commands.executeCommand("setContext", "cloudinary.activeView", "docsAi");
      vscode.commands.executeCommand("workbench.view.extension.cloudinary");
      setTimeout(() => {
        vscode.commands.executeCommand("cloudinaryDocsAI.focus");
        docsAiProvider.flushPendingPrompt(250);
      }, 150);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.showDocsAIConversation", (conversationId?: string) => {
      analytics?.track("docs_ai_opened", {
        entry_point: "command",
        has_initial_conversation: !!conversationId,
      });
      docsAiProvider.queueConversation(conversationId);
      vscode.commands.executeCommand("setContext", "cloudinary.activeView", "docsAi");
      vscode.commands.executeCommand("workbench.view.extension.cloudinary");
      setTimeout(() => {
        vscode.commands.executeCommand("cloudinaryDocsAI.focus");
        docsAiProvider.flushPendingConversation(250);
      }, 150);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.refresh", async () => {
      analytics?.track("library_refreshed", { entry_point: "command" });
      await libraryWebview.refresh();
    })
  );

  registerSearch(context, homescreenProvider);
  registerClearSearch(context, libraryWebview);
  registerViewOptions(context, libraryWebview);
  registerPreview(context, analytics);
  registerUpload(context, cloudinaryService, analytics);
  registerClipboard(context, analytics);
  registerSwitchEnv(context, environmentTarget, statusBar);
  registerWelcomeScreen(context, cloudinaryService);
  registerConfigureAiTools(context);
}

export { registerAllCommands };
