import * as vscode from "vscode";
import { LibraryWebviewViewProvider } from "../webview/libraryView";

type ResourceType = "all" | "image" | "video" | "raw";
type SortDirection = "asc" | "desc";
type ViewStateUpdate = {
  resourceTypeFilter?: ResourceType;
  sortDirection?: SortDirection;
};
type ViewAwareLibraryWebview = LibraryWebviewViewProvider & {
  applyView?: (opts: ViewStateUpdate) => Thenable<void> | Promise<void>;
};

interface ViewOption {
  label: string;
  description?: string;
  kind?: vscode.QuickPickItemKind;
  viewState?: ViewStateUpdate;
}

/**
 * Registers a command that opens a Quick Pick with view options (filter and sort).
 * @param context - VS Code extension context.
 * @param libraryWebview - Cloudinary library webview provider.
 */
function registerViewOptions(
  context: vscode.ExtensionContext,
  libraryWebview?: LibraryWebviewViewProvider
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
            viewState: { resourceTypeFilter: "all" as ResourceType },
          },
          {
            label: "$(file-media) Images Only",
            description: "Show only images",
            viewState: { resourceTypeFilter: "image" as ResourceType },
          },
          {
            label: "$(device-camera-video) Videos Only",
            description: "Show only videos",
            viewState: { resourceTypeFilter: "video" as ResourceType },
          },
          {
            label: "$(file-binary) Raw Files Only",
            description: "Show only raw files",
            viewState: { resourceTypeFilter: "raw" as ResourceType },
          },
          // Sort section
          { label: "Sort Order", kind: vscode.QuickPickItemKind.Separator },
          {
            label: "$(arrow-down) Newest First",
            description: "Most recently uploaded assets first",
            viewState: { sortDirection: "desc" as SortDirection },
          },
          {
            label: "$(arrow-up) Oldest First",
            description: "Oldest uploaded assets first",
            viewState: { sortDirection: "asc" as SortDirection },
          },
        ];

        const selected = await vscode.window.showQuickPick(options, {
          placeHolder: "Select view option",
          matchOnDescription: true,
        });

        if (selected?.viewState) {
          await (libraryWebview as ViewAwareLibraryWebview | undefined)?.applyView?.(selected.viewState);
        }
      }
    )
  );
}

export default registerViewOptions;
