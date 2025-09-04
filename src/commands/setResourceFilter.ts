import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

type ResourceType = "all" | "image" | "video" | "raw";

/**
 * Registers a command to let users filter Cloudinary assets by resource type.
 * @param context - VS Code extension context.
 * @param provider - Cloudinary tree data provider instance.
 */
function registerFilter(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.setResourceFilter",
      async () => {
        const options: ResourceType[] = ["all", "image", "video", "raw"];
        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: "Filter Cloudinary assets by type",
        });

        if (selected) {
          provider.refresh({ resourceTypeFilter: selected as ResourceType });
        }
      }
    )
  );
}

export default registerFilter;
