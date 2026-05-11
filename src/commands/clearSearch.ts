import * as vscode from "vscode";
import { LibraryWebviewViewProvider } from "../webview/libraryView";

type SearchAwareLibraryWebview = LibraryWebviewViewProvider & {
    setSearch?: (query: string | null) => Thenable<void> | Promise<void>;
};

/**
 * Registers a command that clears the active search filter in the Cloudinary view.
 * @param context - The VS Code extension context.
 * @param libraryWebview - The Cloudinary library webview provider.
 */
function registerClearSearch(
    context: vscode.ExtensionContext,
    libraryWebview?: LibraryWebviewViewProvider
) {
    context.subscriptions.push(
        vscode.commands.registerCommand("cloudinary.clearSearch", async () => {
            await (libraryWebview as SearchAwareLibraryWebview | undefined)?.setSearch?.(null);
        })
    );
}

export default registerClearSearch;
