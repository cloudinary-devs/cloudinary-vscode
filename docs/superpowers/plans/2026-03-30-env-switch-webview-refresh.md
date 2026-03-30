# Environment Switch Webview Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `cloudinary.switchEnvironment` completes, all open webviews update: the homescreen shows the new cloud name, the upload panel resets for the new environment, and any open preview panels display a placeholder indicating the asset is from a different environment.

**Architecture:** Add `onDidChangeEnvironment` event emitter to `CloudinaryTreeDataProvider` as the single notification point. Fire it from `switchEnvironment.ts` (and the config file watcher in `extension.ts`) after credentials are updated. Subscribe in `extension.ts` to call `homescreenProvider.refresh()`, `resetUploadPanel()`, and `resetAllPreviewPanels()`.

**Tech Stack:** TypeScript, VS Code Extension API (`EventEmitter`, `WebviewPanel`, `WebviewViewProvider`)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/tree/treeDataProvider.ts:38-39` | Add `_onDidChangeEnvironment` emitter + `notifyEnvironmentChange()` method |
| Modify | `src/webview/homescreenView.ts` | Store `_webviewView` ref; add public `refresh()` that re-assigns `.html` |
| Modify | `src/commands/uploadWidget.ts` | Export `resetUploadPanel()` — disposes and reopens the singleton panel if open |
| Modify | `src/commands/previewAsset.ts` | Export `resetAllPreviewPanels()` — replaces each open panel's HTML with an env-changed placeholder |
| Modify | `src/commands/switchEnvironment.ts:78-83` | Call `provider.notifyEnvironmentChange()` after `provider.refresh()` |
| Modify | `src/extension.ts:194-199,227` | Subscribe to `onDidChangeEnvironment`; fire notification in config file watcher too |

---

### Task 1: Add `onDidChangeEnvironment` event to `CloudinaryTreeDataProvider`

**Files:**
- Modify: `src/tree/treeDataProvider.ts:38-39`

The tree provider already uses a `vscode.EventEmitter` for tree data changes. Add a second emitter for environment changes alongside it.

- [ ] **Step 1: Add the emitter and method**

In `src/tree/treeDataProvider.ts`, after line 39 (`readonly onDidChangeTreeData = this._onDidChangeTreeData.event;`), add:

```typescript
  private _onDidChangeEnvironment = new vscode.EventEmitter<void>();
  readonly onDidChangeEnvironment = this._onDidChangeEnvironment.event;

  /**
   * Fires the onDidChangeEnvironment event to notify subscribers that
   * credentials have changed to a new environment.
   */
  notifyEnvironmentChange(): void {
    this._onDidChangeEnvironment.fire();
  }
```

The full block around the change (lines 38–42) should look like:

```typescript
  private _onDidChangeTreeData = new vscode.EventEmitter<CloudinaryItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _onDidChangeEnvironment = new vscode.EventEmitter<void>();
  readonly onDidChangeEnvironment = this._onDidChangeEnvironment.event;

  /**
   * Fires the onDidChangeEnvironment event to notify subscribers that
   * credentials have changed to a new environment.
   */
  notifyEnvironmentChange(): void {
    this._onDidChangeEnvironment.fire();
  }

  /**
   * Refreshes the tree data view.
   */
  refresh(stateUpdate: Partial<typeof this.viewState> = {}, append = false) {
```

- [ ] **Step 2: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/tree/treeDataProvider.ts
git commit -m "feat: add onDidChangeEnvironment event to CloudinaryTreeDataProvider"
```

---

### Task 2: Add `refresh()` to `HomescreenViewProvider`

**Files:**
- Modify: `src/webview/homescreenView.ts`

`resolveWebviewView` is called lazily by VS Code once the sidebar is first shown. Store the resolved view so `refresh()` can re-assign `.html` later.

- [ ] **Step 1: Add `_webviewView` field and `refresh()` method**

In `src/webview/homescreenView.ts`, change the class body as follows:

Add a private field declaration after the constructor (between `constructor` and `resolveWebviewView`):

```typescript
  private _webviewView: vscode.WebviewView | undefined;
```

In `resolveWebviewView`, add `this._webviewView = webviewView;` as the very first line of the method body:

```typescript
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._webviewView = webviewView;   // ← add this line

    webviewView.webview.options = {
```

Add a new public method after `resolveWebviewView` and before `_getBodyContent`:

```typescript
  /**
   * Re-renders the homescreen HTML with current credentials.
   * Safe to call at any time; no-ops if the view has not been resolved yet.
   */
  refresh(): void {
    if (!this._webviewView) {
      return;
    }
    const scriptUri = getScriptUri(
      this._webviewView.webview,
      this._extensionUri,
      "homescreen.js"
    );
    this._webviewView.webview.html = createWebviewDocument({
      title: "Cloudinary",
      webview: this._webviewView.webview,
      extensionUri: this._extensionUri,
      bodyContent: this._getBodyContent(),
      additionalScripts: [scriptUri],
    });
  }
```

- [ ] **Step 2: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/webview/homescreenView.ts
git commit -m "feat: add refresh() to HomescreenViewProvider"
```

---

### Task 3: Export `resetUploadPanel()` from `uploadWidget.ts`

**Files:**
- Modify: `src/commands/uploadWidget.ts`

The module-level `uploadPanel` singleton tracks whether the panel is open. If open when the environment switches, dispose it and immediately reopen it for the new environment (preserving the last folder path via `currentFolderPath`).

- [ ] **Step 1: Add the exported function**

In `src/commands/uploadWidget.ts`, add the following function after the closing `}` of `registerUpload` (after line 75, before `openOrRevealUploadPanel`):

```typescript
/**
 * Resets the upload panel for a new environment.
 * If the panel is currently open, disposes it and reopens it with the new
 * credentials already loaded in `provider`. No-ops if the panel is closed.
 */
export function resetUploadPanel(
  provider: CloudinaryTreeDataProvider,
  context: vscode.ExtensionContext
): void {
  if (!uploadPanel) {
    return;
  }
  // Dispose first. The onDidDispose handler sets uploadPanel = undefined.
  uploadPanel.dispose();
  // Reopen immediately with new env credentials.
  openOrRevealUploadPanel(currentFolderPath, provider, context);
}
```

- [ ] **Step 2: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/commands/uploadWidget.ts
git commit -m "feat: export resetUploadPanel for environment change handling"
```

---

### Task 4: Export `resetAllPreviewPanels()` from `previewAsset.ts`

**Files:**
- Modify: `src/commands/previewAsset.ts`

The module-level `openPanels: Map<string, vscode.WebviewPanel>` tracks all open preview tabs. When the environment changes, replace each panel's HTML with a minimal placeholder telling the user the asset is from a different environment.

- [ ] **Step 1: Add the placeholder HTML helper and exported function**

In `src/commands/previewAsset.ts`, add the following after the closing `}` of `registerPreview` (after line 120):

```typescript
/**
 * Returns placeholder body HTML for an environment-changed preview panel.
 */
function getEnvChangedBodyContent(): string {
  return `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 12px;
      padding: 24px;
      text-align: center;
      font-family: var(--vscode-font-family);
    ">
      <svg width="32" height="32" viewBox="0 0 16 16" fill="var(--vscode-descriptionForeground)" aria-hidden="true">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
      </svg>
      <p style="font-size: 13px; color: var(--vscode-foreground); margin: 0;">Environment changed</p>
      <p style="font-size: 11px; color: var(--vscode-descriptionForeground); margin: 0; line-height: 1.5;">
        This preview is from a different environment.<br>
        Close this tab and browse the new environment.
      </p>
    </div>
  `;
}

/**
 * Replaces all open preview panels' HTML with an environment-changed placeholder.
 * Called when the active Cloudinary environment switches.
 */
export function resetAllPreviewPanels(extensionUri: vscode.Uri): void {
  for (const panel of openPanels.values()) {
    panel.webview.html = createWebviewDocument({
      title: "Environment Changed",
      webview: panel.webview,
      extensionUri,
      bodyContent: getEnvChangedBodyContent(),
    });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/commands/previewAsset.ts
git commit -m "feat: export resetAllPreviewPanels for environment change handling"
```

---

### Task 5: Wire up all env-change handlers in `extension.ts` and `switchEnvironment.ts`

**Files:**
- Modify: `src/commands/switchEnvironment.ts:78-83`
- Modify: `src/extension.ts`

This is the final integration step. Fire `notifyEnvironmentChange()` from two places where credentials change (`switchEnvironment` command and the config file watcher). Subscribe to `onDidChangeEnvironment` in `extension.ts` and call the three handlers.

- [ ] **Step 1: Fire `notifyEnvironmentChange()` in `switchEnvironment.ts`**

In `src/commands/switchEnvironment.ts`, after the `provider.refresh(...)` call (after line 83), add:

```typescript
          provider.notifyEnvironmentChange();
```

The block around lines 78–88 should look like:

```typescript
          provider.refresh({
            folderPath: '',
            nextCursor: null,
            searchQuery: null,
            resourceTypeFilter: 'all'
          });

          provider.notifyEnvironmentChange();

          vscode.window.showInformationMessage(
            `🔄 Switched to ${selected} environment.`
          );
```

- [ ] **Step 2: Add imports to `extension.ts`**

In `src/extension.ts`, add the two new imports to the existing import block at the top:

```typescript
import { resetUploadPanel } from "./commands/uploadWidget";
import { resetAllPreviewPanels } from "./commands/previewAsset";
```

- [ ] **Step 3: Subscribe to `onDidChangeEnvironment` in `extension.ts`**

In `src/extension.ts`, in the `activate()` function, after the block that registers `HomescreenViewProvider` (after line 54, before the `isFirstRun` check), add:

```typescript
  // Refresh all open webviews when the active environment changes.
  context.subscriptions.push(
    cloudinaryProvider.onDidChangeEnvironment(() => {
      homescreenProvider.refresh();
      resetUploadPanel(cloudinaryProvider, context);
      resetAllPreviewPanels(context.extensionUri);
    })
  );
```

The full section should look like:

```typescript
  // Register homescreen sidebar view
  const homescreenProvider = new HomescreenViewProvider(context.extensionUri, cloudinaryProvider);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      HomescreenViewProvider.viewType,
      homescreenProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Refresh all open webviews when the active environment changes.
  context.subscriptions.push(
    cloudinaryProvider.onDidChangeEnvironment(() => {
      homescreenProvider.refresh();
      resetUploadPanel(cloudinaryProvider, context);
      resetAllPreviewPanels(context.extensionUri);
    })
  );

  // Check if this is the first run of the extension
  const isFirstRun = context.globalState.get('cloudinary.firstRun', true);
```

- [ ] **Step 4: Fire `notifyEnvironmentChange()` in the config file watcher**

In `src/extension.ts`, inside the `watcher.onDidChange(async () => { ... })` handler (around line 194–199), after the `cloudinaryProvider.refresh(...)` call, add:

```typescript
    cloudinaryProvider.notifyEnvironmentChange();
```

The block around the watcher's refresh call should look like:

```typescript
    cloudinaryProvider.refresh({
      folderPath: '',
      nextCursor: null,
      searchQuery: null,
      resourceTypeFilter: 'all'
    });

    cloudinaryProvider.notifyEnvironmentChange();
  });
```

- [ ] **Step 5: Type-check and build**

```bash
npm run compile
```

Expected: no errors, `dist/extension.js` updated.

- [ ] **Step 6: Manual smoke test**

Press `F5` to launch the Extension Development Host. Verify:

1. Open the Cloudinary sidebar — homescreen shows current cloud name.
2. Open a preview panel (click any asset in the library).
3. Open the upload widget (`cloudinary.openUploadWidget`).
4. Run `cloudinary.switchEnvironment` and pick a different environment.
5. **Homescreen** should immediately show the new cloud name and "Connected" pill.
6. **Upload widget** should close and reopen showing the new cloud name.
7. **Preview panel** should show "Environment changed" with the placeholder message.

- [ ] **Step 7: Commit**

```bash
git add src/commands/switchEnvironment.ts src/extension.ts
git commit -m "feat: wire up webview refresh on environment switch"
```
