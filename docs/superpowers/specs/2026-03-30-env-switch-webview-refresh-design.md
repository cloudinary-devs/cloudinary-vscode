# Environment Switch Webview Refresh — Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Overview

When the user runs `cloudinary.switchEnvironment`, all open webviews must reflect the new environment immediately. Currently the tree view refreshes but the homescreen, upload widget, and any open preview panels remain stale.

## Architecture

Add an `onDidChangeEnvironment` event to `CloudinaryTreeDataProvider`. Fire it from `switchEnvironment.ts` after credentials are updated. Subscribe in `extension.ts` to orchestrate updates to all open webviews.

```
switchEnvironment.ts
  └─ provider.notifyEnvironmentChange()
       └─ onDidChangeEnvironment fires
            ├─ homescreenProvider.refresh()        → re-render header with new cloud name
            ├─ resetUploadPanel(provider, context) → dispose + reopen if was open
            └─ resetAllPreviewPanels()             → replace HTML with placeholder
```

The `CloudinaryTreeDataProvider` is the natural owner of this event because it already holds all credential state and its `refresh()` is already the canonical "env changed" signal for the tree view.

## Component Changes

### `CloudinaryTreeDataProvider` (`src/tree/treeDataProvider.ts`)

Add alongside the existing `_onDidChangeTreeData`:

```typescript
private _onDidChangeEnvironment = new vscode.EventEmitter<void>();
readonly onDidChangeEnvironment = this._onDidChangeEnvironment.event;

notifyEnvironmentChange(): void {
  this._onDidChangeEnvironment.fire();
}
```

### `switchEnvironment.ts`

After `provider.refresh(...)`, add:

```typescript
provider.notifyEnvironmentChange();
```

### `HomescreenViewProvider` (`src/webview/homescreenView.ts`)

Store the resolved view and expose a `refresh()` method:

```typescript
private _webviewView: vscode.WebviewView | undefined;

// In resolveWebviewView, add:
this._webviewView = webviewView;

// New public method:
refresh(): void {
  if (!this._webviewView) { return; }
  this._webviewView.webview.html = createWebviewDocument({
    title: "Cloudinary",
    webview: this._webviewView.webview,
    extensionUri: this._extensionUri,
    bodyContent: this._getBodyContent(),
    additionalScripts: [getScriptUri(this._webviewView.webview, this._extensionUri, "homescreen.js")],
  });
}
```

Re-assigning `.html` is safe; VS Code replaces the webview DOM atomically.

### `uploadWidget.ts`

Export a `resetUploadPanel` function:

```typescript
export function resetUploadPanel(
  provider: CloudinaryTreeDataProvider,
  context: vscode.ExtensionContext
): void {
  if (!uploadPanel) { return; }
  uploadPanel.dispose();   // sets uploadPanel = undefined via onDidDispose
  openOrRevealUploadPanel(currentFolderPath, provider, context);
}
```

This preserves the user's last folder context (`currentFolderPath`) when reopening.

### `previewAsset.ts`

Export a `resetAllPreviewPanels` function:

```typescript
export function resetAllPreviewPanels(extensionUri: vscode.Uri): void {
  for (const panel of openPanels.values()) {
    panel.webview.html = getEnvChangedPlaceholderHtml(panel.webview, extensionUri);
  }
}
```

The placeholder HTML is a minimal page saying "Environment changed — close this tab and browse the new environment." Panels are not disposed so the user's tabs remain (they can close them manually).

### `extension.ts`

After registering `HomescreenViewProvider`:

```typescript
context.subscriptions.push(
  provider.onDidChangeEnvironment(() => {
    homescreenProvider.refresh();
    resetUploadPanel(provider, context);
    resetAllPreviewPanels(context.extensionUri);
  })
);
```

## Files

**Modified:**
- `src/tree/treeDataProvider.ts` — add event emitter + `notifyEnvironmentChange()`
- `src/commands/switchEnvironment.ts` — fire `notifyEnvironmentChange()` after `provider.refresh()`
- `src/webview/homescreenView.ts` — store `_webviewView`, add `refresh()`
- `src/commands/uploadWidget.ts` — export `resetUploadPanel()`
- `src/commands/previewAsset.ts` — export `resetAllPreviewPanels()`
- `src/extension.ts` — subscribe to `onDidChangeEnvironment`

## Future Considerations

- If the upload panel is ever made multi-instance, `resetUploadPanel` will need to iterate all instances.
- The preview placeholder could offer a "Close all previews" button that posts a message handled by VS Code to dispose the panels, once that UX is desired.
