# Adding Features

This guide covers the current extension shape after the sidebar moved to webview-based homescreen and library views.

## Adding a New Command

Commands still live in `src/commands/`, but they now work from shared services and webview providers rather than a sidebar tree state object.

### 1. Create the Command File

```typescript
// src/commands/myNewCommand.ts
import * as vscode from "vscode";
import { CloudinaryService } from "../cloudinary/cloudinaryService";

function registerMyNewCommand(
  context: vscode.ExtensionContext,
  cloudinaryService: CloudinaryService
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.myNewCommand", async () => {
      if (!cloudinaryService.cloudName) {
        vscode.window.showWarningMessage("Cloudinary is not configured.");
        return;
      }

      vscode.window.showInformationMessage(
        `Running against ${cloudinaryService.cloudName}`
      );
    })
  );
}

export default registerMyNewCommand;
```

If the command needs to update the library UI, accept `LibraryWebviewViewProvider` and call methods such as `refresh()`, `setSearch()`, or `applyView(...)`.

### 2. Register the Command

Add it in `src/commands/registerCommands.ts`:

```typescript
import registerMyNewCommand from "./myNewCommand";

function registerAllCommands(
  context: vscode.ExtensionContext,
  cloudinaryService: CloudinaryService,
  environmentTarget: Parameters<typeof registerSwitchEnv>[1],
  statusBar: vscode.StatusBarItem,
  homescreenProvider: HomescreenViewProvider,
  libraryWebview?: LibraryWebviewViewProvider
) {
  // ...existing registrations
  registerMyNewCommand(context, cloudinaryService);
}
```

### 3. Add It to `package.json`

```json
{
  "contributes": {
    "commands": [
      {
        "command": "cloudinary.myNewCommand",
        "title": "My New Command",
        "category": "Cloudinary"
      }
    ]
  }
}
```

The library toolbar and context actions are rendered inside the webview, so most new UI affordances do not need `contributes.menus`.

## Extending the Library Webview

The media library is implemented by `src/webview/libraryView.ts` plus the client bundle in `src/webview/client/library.ts`.

### Host-side changes

Use `LibraryWebviewViewProvider` when you need to:

- send new data into the webview
- respond to `postMessage(...)` events from the client
- persist small UI preferences in `context.globalState`

Host messages are handled in `handleMessage(...)`. Outbound posts use the private `post(...)` helper, which wraps `webview.postMessage(...)` in a try/catch so late callbacks (prefetches, env-change broadcasts) do not throw `Webview is disposed` after a view collapses. Add new helpers via the same wrapper rather than calling `webview.postMessage` directly.

When something on the host changes that the client should reflect immediately (env switch, refresh), prefer the existing routes — `envChanged()`, `refresh()`, `setSearch()`, `applyView(...)` — instead of posting raw messages.

### Client-side changes

Add interactive behavior in `src/webview/client/`:

- `library.ts` — main row rendering, selection, keyboard nav, message dispatch
- `libraryVirtualList.ts` — windowed render math (row height fixed at 22px)
- `libraryRowSplice.ts` — depth-aware splice helper for streaming nested folder appends
- `libraryIcons.ts` — duplicated SVG icon set used at row-render time (the client cannot import `src/webview/icons.ts`; keep these two in sync when adding a glyph used in both surfaces)
- `libraryMenu.ts` — context menu
- `libraryHoverPreview.ts` — delayed thumbnail hover card with metadata strip

These files are bundled by `esbuild.js` into `media/scripts/`.

### Library UI conventions

- **Row height** is fixed at 22px (`--lib-row-height`). Do not introduce variable row heights — virtualization assumes a constant.
- **Icon slots** are 18×22 flexbox-centered. New row kinds should follow the same pattern: `<indent><twistie><icon><name>` so vertical alignment matches existing rows.
- **Brand accents** come from `tokens.css` — use `--lib-accent` (sky blue) and the `--lib-accent-soft/-strong` derivatives. Avoid hardcoded colors.
- **Toolbar groups** are HTML siblings with `gap` for spacing instead of vertical hairline dividers; the utility group uses `margin-left: auto` to push to the right edge.
- **Search and filters** stay visible in the library header. Do not add toolbar toggles for core browse controls unless the layout changes again.

## Adding a New Webview Panel or View

Use the shared webview helpers in `src/webview/webviewUtils.ts`:

```typescript
import * as vscode from "vscode";
import {
  createWebviewDocument,
  getScriptUri,
  getStyleUri,
} from "../webview/webviewUtils";

function openMyPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "cloudinaryMyPanel",
    "My Panel",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    }
  );

  const scriptUri = getScriptUri(panel.webview, context.extensionUri, "my-panel.js");
  const styleUri = getStyleUri(panel.webview, context.extensionUri, "my-panel.css");

  panel.webview.html = createWebviewDocument({
    title: "My Panel",
    webview: panel.webview,
    extensionUri: context.extensionUri,
    bodyContent: `<div id="root"></div>`,
    additionalStyles: [styleUri],
    additionalScripts: [scriptUri],
  });
}
```

Keep styling on VS Code theme tokens such as `--vscode-editor-foreground`.

## Adding Configuration Options

Configuration still comes from Cloudinary environment files, not VS Code settings.

### 1. Update the Config Type

Add the field to `CloudinaryEnvironment` in `src/config/configUtils.ts`.

### 2. Thread It Through Activation

If the option affects runtime behavior, read it during activation or environment switching and write it onto `CloudinaryService` or the specific provider/panel that needs it.

### 3. Document It

Update the relevant docs in `docs/`.

## Common Patterns

### Error Handling

```typescript
import { handleCloudinaryError } from "../utils/cloudinaryErrorHandler";

try {
  await cloudinaryService.fetchChildren("");
} catch (err: any) {
  handleCloudinaryError("Failed to load assets", err);
}
```

### User Input

```typescript
const query = await vscode.window.showInputBox({
  placeHolder: "Enter search term",
  prompt: "Search assets by public ID",
});

if (!query) {
  return;
}
```

### Refreshing the Sidebar

```typescript
await libraryWebview?.refresh();
await homescreenProvider.refresh();
```

Use the narrowest refresh path you need. Do not recreate deprecated tree-provider refresh flows.

## Testing Your Changes

1. Run `npm run check-types`.
2. Run `npm run compile`.
3. Run `npm run lint` for command and extension changes.
4. Run `npm run compile-tests` when you add or update tests.
5. Launch the Extension Development Host with `F5` for manual verification.

## Code Style Guidelines

1. Keep command registration patterns consistent with `src/commands/registerCommands.ts`.
2. Use `CloudinaryService` for Cloudinary state and API access.
3. Keep webview host logic in `src/webview/*.ts` and browser-side logic in `src/webview/client/*.ts`.
4. Use `handleCloudinaryError()` for Cloudinary API failures.
5. Prefer narrowing documentation claims over describing behavior that is not implemented.
