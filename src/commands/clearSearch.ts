import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

/**
 * Registers a command that clears the active search filter in the Cloudinary view.
 * @param context - The VS Code extension context.
 * @param provider - The Cloudinary tree data provider instance.
 */
function registerClearSearch(
    context: vscode.ExtensionContext,
    provider: CloudinaryTreeDataProvider
) {
    context.subscriptions.push(
        vscode.commands.registerCommand("cloudinary.clearSearch", () => {
            provider.refresh({
                folderPath: '',
                nextCursor: null,
                searchQuery: null,
                resourceTypeFilter: 'all'
            });
            vscode.window.showInformationMessage("🔍 Search filter cleared.");
        })
    );
}

export default registerClearSearch;