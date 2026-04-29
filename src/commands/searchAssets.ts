import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import { HomescreenViewProvider } from "../webview/homescreenView";

/**
 * Registers the search command. Opens the dashboard and focuses its search input.
 */
function registerSearch(
  context: vscode.ExtensionContext,
  _provider: CloudinaryTreeDataProvider,
  homescreenProvider: HomescreenViewProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.searchAssets", () => {
      homescreenProvider.focusSearch();
    })
  );
}

export default registerSearch;
