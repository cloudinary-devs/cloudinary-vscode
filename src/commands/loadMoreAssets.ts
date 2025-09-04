import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

/**
 * Registers the 'load more assets' command to handle pagination in the Cloudinary tree.
 * @param context - VS Code extension context.
 * @param provider - Instance of CloudinaryTreeDataProvider used to fetch and update asset nodes.
 */
function registerLoadMore(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.loadMoreAssets",
      async (folderPath: string, nextCursor: string) => {
        if (!nextCursor) {
          vscode.window.showErrorMessage("No more assets to load.");
          return;
        }

        const newAssets = await provider.fetchFoldersAndAssets(
          folderPath,
          nextCursor,
          true
        );

        if (newAssets.length === 0) {
          vscode.window.showErrorMessage("No additional assets found.");
          return;
        }

        provider.updateLoadMoreItem(folderPath, nextCursor);

        provider.refresh(
          {
            folderPath,
            nextCursor
          },
          true
        );
      }
    )
  );
}

export default registerLoadMore;