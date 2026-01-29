import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";

type ResourceType = "all" | "image" | "video" | "raw";
type SortDirection = "asc" | "desc";

interface ViewOption {
  label: string;
  description?: string;
  kind?: vscode.QuickPickItemKind;
  action?: () => void;
}

/**
 * Registers a command that opens a Quick Pick with view options (filter and sort).
 * @param context - VS Code extension context.
 * @param provider - Cloudinary tree data provider instance.
 */
function registerViewOptions(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.viewOptions",
      async () => {
        const options: ViewOption[] = [
          // Filter section
          { label: "Filter by Type", kind: vscode.QuickPickItemKind.Separator },
          {
            label: "$(file) All Types",
            description: "Show all asset types",
            action: () => provider.refresh({ resourceTypeFilter: "all" as ResourceType }),
          },
          {
            label: "$(file-media) Images Only",
            description: "Show only images",
            action: () => provider.refresh({ resourceTypeFilter: "image" as ResourceType }),
          },
          {
            label: "$(device-camera-video) Videos Only",
            description: "Show only videos",
            action: () => provider.refresh({ resourceTypeFilter: "video" as ResourceType }),
          },
          {
            label: "$(file-binary) Raw Files Only",
            description: "Show only raw files",
            action: () => provider.refresh({ resourceTypeFilter: "raw" as ResourceType }),
          },
          // Sort section
          { label: "Sort Order", kind: vscode.QuickPickItemKind.Separator },
          {
            label: "$(arrow-down) Newest First",
            description: "Most recently uploaded assets first",
            action: () => provider.refresh({ sortDirection: "desc" as SortDirection }),
          },
          {
            label: "$(arrow-up) Oldest First",
            description: "Oldest uploaded assets first",
            action: () => provider.refresh({ sortDirection: "asc" as SortDirection }),
          },
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: "Select view option",
          matchOnDescription: true,
        });

        if (selected && selected.action) {
          selected.action();
        }
      }
    )
  );
}

export default registerViewOptions;
