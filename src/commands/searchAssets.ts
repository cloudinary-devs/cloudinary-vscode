import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

/**
 * Registers a command that allows users to search for Cloudinary assets by public ID.
 * @param context - The VS Code extension context.
 * @param provider - Cloudinary tree data provider used to refresh view based on search.
 */
function registerSearch(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.searchAssets", async () => {
      const query = await vscode.window.showInputBox({
        placeHolder: "Search for a public id",
      });

      if (query !== undefined && query.trim() !== "") {
        provider.refresh({ searchQuery: query.trim() });
      } else {
        vscode.window.showErrorMessage("Search query cannot be empty.");
      }
    })
  );
}

export default registerSearch;