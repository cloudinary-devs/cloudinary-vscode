import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

type SortDirection = "asc" | "desc";

interface SortOption {
  label: string;
  description: string;
  direction: SortDirection;
}

const sortOptions: SortOption[] = [
  {
    label: "$(arrow-down) Newest first",
    description: "Most recently uploaded assets first",
    direction: "desc",
  },
  {
    label: "$(arrow-up) Oldest first",
    description: "Oldest uploaded assets first",
    direction: "asc",
  },
];

/**
 * Registers a command to let users change the sort order of Cloudinary assets.
 * @param context - VS Code extension context.
 * @param provider - Cloudinary tree data provider instance.
 */
function registerSortOrder(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.setSortOrder",
      async () => {
        const selected = await vscode.window.showQuickPick(sortOptions, {
          placeHolder: "Sort assets by...",
          matchOnDescription: true,
        });

        if (selected) {
          provider.refresh({
            sortDirection: selected.direction,
          });
        }
      }
    )
  );
}

export default registerSortOrder;
