import * as vscode from "vscode";
import { HomescreenViewProvider } from "../webview/homescreenView";

function registerSearch(
  context: vscode.ExtensionContext,
  homescreenProvider: HomescreenViewProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.searchAssets", () => {
      homescreenProvider.focusSearch();
    })
  );
}

export default registerSearch;
