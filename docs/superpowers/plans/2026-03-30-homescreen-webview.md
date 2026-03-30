# Homescreen WebviewView Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal dashboard homescreen as a `WebviewViewProvider` in the Cloudinary sidebar, toggling with the existing tree view via VS Code context variables.

**Architecture:** Two views (`cloudinaryHomescreen` as a WebviewView and `cloudinaryMediaLibrary` as a tree view) are registered in the `cloudinary` activity bar container with mutually exclusive `when` clauses driven by the `cloudinary.activeView` context variable. The homescreen shows connection status and three quick-action buttons; `cloudinary.showLibrary` and `cloudinary.showHomescreen` commands switch between them.

**Tech Stack:** TypeScript, VS Code Extension API (`WebviewViewProvider`, `setContext`), esbuild, existing design system (`createWebviewDocument`, VS Code CSS variables)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/webview/client/homescreen.ts` | Client-side message handlers bundled to `media/scripts/homescreen.js` |
| Create | `src/webview/homescreenView.ts` | `HomescreenViewProvider` — generates HTML, handles messages |
| Modify | `esbuild.js:24-27` | Add `homescreen.ts` to browser entry points |
| Modify | `src/commands/registerCommands.ts:22-44` | Register `showHomescreen` and `showLibrary` commands |
| Modify | `package.json:50-57` (views) | Add homescreen view with `when` clause, add `when` to tree view |
| Modify | `package.json:58-116` (commands) | Add two new commands |
| Modify | `package.json:117-144` (menus) | Add `$(home)` button to tree view title bar |
| Modify | `src/extension.ts:39-44` | Set initial context, register `HomescreenViewProvider` |

---

### Task 1: Add homescreen client script entry to esbuild

**Files:**
- Modify: `esbuild.js:24-27`

- [ ] **Step 1: Add the entry point**

In `esbuild.js`, find the `entryPoints` array for the webview build (around line 24) and add the homescreen client script:

```js
// Before:
entryPoints: [
  "src/webview/client/preview.ts",
  "src/webview/client/upload-widget.ts",
  "src/webview/client/welcome.ts",
],

// After:
entryPoints: [
  "src/webview/client/preview.ts",
  "src/webview/client/upload-widget.ts",
  "src/webview/client/welcome.ts",
  "src/webview/client/homescreen.ts",
],
```

- [ ] **Step 2: Commit**

```bash
git add esbuild.js
git commit -m "build: add homescreen client script entry to esbuild"
```

---

### Task 2: Create homescreen client script

**Files:**
- Create: `src/webview/client/homescreen.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * Homescreen webview client-side script.
 * Handles button actions by posting messages to the extension host.
 */

import { initVSCode, getVSCode } from "./common";

function openGlobalConfig(): void {
  getVSCode()?.postMessage({ command: "openGlobalConfig" });
}

function showLibrary(): void {
  getVSCode()?.postMessage({ command: "showLibrary" });
}

function openUploadWidget(): void {
  getVSCode()?.postMessage({ command: "openUploadWidget" });
}

function searchAssets(): void {
  getVSCode()?.postMessage({ command: "searchAssets" });
}

function openWelcomeScreen(): void {
  getVSCode()?.postMessage({ command: "openWelcomeScreen" });
}

declare global {
  interface Window {
    openGlobalConfig: typeof openGlobalConfig;
    showLibrary: typeof showLibrary;
    openUploadWidget: typeof openUploadWidget;
    searchAssets: typeof searchAssets;
    openWelcomeScreen: typeof openWelcomeScreen;
  }
}

window.openGlobalConfig = openGlobalConfig;
window.showLibrary = showLibrary;
window.openUploadWidget = openUploadWidget;
window.searchAssets = searchAssets;
window.openWelcomeScreen = openWelcomeScreen;

initVSCode();
```

- [ ] **Step 2: Verify it type-checks**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/webview/client/homescreen.ts
git commit -m "feat: add homescreen client script"
```

---

### Task 3: Create `HomescreenViewProvider`

**Files:**
- Create: `src/webview/homescreenView.ts`

This provider implements `vscode.WebviewViewProvider`. VS Code calls `resolveWebviewView` lazily when the sidebar becomes visible. By that time `activate()` has completed and the `CloudinaryTreeDataProvider` has its credentials set.

- [ ] **Step 1: Create the file**

```typescript
/**
 * Homescreen WebviewView provider.
 * Renders the minimal dashboard in the Cloudinary sidebar.
 */

import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import { createWebviewDocument, getScriptUri } from "./webviewUtils";
import { escapeHtml } from "./utils/helpers";

export class HomescreenViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cloudinaryHomescreen";

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _provider: CloudinaryTreeDataProvider
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "media")],
    };

    const scriptUri = getScriptUri(
      webviewView.webview,
      this._extensionUri,
      "homescreen.js"
    );

    webviewView.webview.html = createWebviewDocument({
      title: "Cloudinary",
      webview: webviewView.webview,
      extensionUri: this._extensionUri,
      bodyContent: this._getBodyContent(),
      additionalScripts: [scriptUri],
    });

    webviewView.webview.onDidReceiveMessage(
      (message: { command: string }) => {
        switch (message.command) {
          case "openGlobalConfig":
            vscode.commands.executeCommand("cloudinary.openGlobalConfig");
            break;
          case "showLibrary":
            vscode.commands.executeCommand("cloudinary.showLibrary");
            break;
          case "openUploadWidget":
            vscode.commands.executeCommand("cloudinary.openUploadWidget");
            break;
          case "searchAssets":
            vscode.commands.executeCommand("cloudinary.searchAssets");
            break;
          case "openWelcomeScreen":
            vscode.commands.executeCommand("cloudinary.openWelcomeScreen");
            break;
        }
      }
    );
  }

  private _getBodyContent(): string {
    const hasConfig = !!(this._provider.cloudName && this._provider.apiKey);
    const cloudName = escapeHtml(this._provider.cloudName || "");

    return `
      <div class="container">
        <div class="status-card">
          <div class="status-card__icon status-card__icon--${hasConfig ? "success" : "warning"}">
            ${hasConfig ? "✓" : "⚠"}
          </div>
          <div class="status-card__content">
            <div class="status-card__title">${hasConfig ? cloudName : "Not Configured"}</div>
            <p class="status-card__text">${hasConfig ? "Connected" : "Setup required"}</p>
          </div>
          ${!hasConfig
            ? `<button class="btn btn--primary btn--sm" onclick="openGlobalConfig()">Configure</button>`
            : ""}
        </div>

        <div class="btn-group btn-group--vertical" style="margin-top: 1rem; width: 100%;">
          <button class="btn btn--secondary btn--md" style="width: 100%;" onclick="showLibrary()">
            Browse Library
          </button>
          <button class="btn btn--secondary btn--md" style="width: 100%;" onclick="openUploadWidget()">
            Upload
          </button>
          <button class="btn btn--secondary btn--md" style="width: 100%;" onclick="searchAssets()">
            Search
          </button>
        </div>

        <div style="margin-top: 1.5rem; text-align: center;">
          <span class="link" onclick="openWelcomeScreen()">Welcome Guide</span>
        </div>
      </div>
    `;
  }
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/webview/homescreenView.ts
git commit -m "feat: add HomescreenViewProvider"
```

---

### Task 4: Register navigation commands

**Files:**
- Modify: `src/commands/registerCommands.ts`

- [ ] **Step 1: Add the two commands to `registerAllCommands`**

In `registerCommands.ts`, add at the top of `registerAllCommands` (before `registerSearch`):

```typescript
// Add this import at the top of the file (no new import needed — vscode is already available via parameters)

// Inside registerAllCommands, before registerSearch(context, provider):
context.subscriptions.push(
  vscode.commands.registerCommand("cloudinary.showHomescreen", () => {
    vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");
  })
);

context.subscriptions.push(
  vscode.commands.registerCommand("cloudinary.showLibrary", () => {
    vscode.commands.executeCommand("setContext", "cloudinary.activeView", "library");
    vscode.commands.executeCommand("workbench.view.extension.cloudinary");
  })
);
```

The full updated `registerAllCommands` function:

```typescript
function registerAllCommands(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider,
  statusBar: vscode.StatusBarItem
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.showHomescreen", () => {
      vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.showLibrary", () => {
      vscode.commands.executeCommand("setContext", "cloudinary.activeView", "library");
      vscode.commands.executeCommand("workbench.view.extension.cloudinary");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.refresh", () =>
      provider.refresh({
        folderPath: '',
        nextCursor: null,
        searchQuery: null,
        resourceTypeFilter: 'all'
      })
    )
  );

  registerSearch(context, provider);
  registerClearSearch(context, provider);
  registerViewOptions(context, provider);
  registerPreview(context);
  registerUpload(context, provider);
  registerClipboard(context);
  registerSwitchEnv(context, provider, statusBar);
  registerWelcomeScreen(context, provider);
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
npm run check-types
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/commands/registerCommands.ts
git commit -m "feat: register showHomescreen and showLibrary commands"
```

---

### Task 5: Update `package.json` — views, commands, menus

**Files:**
- Modify: `package.json`

Make three separate edits in `package.json`:

- [ ] **Step 1: Update the `views` section**

Replace the existing `"views"` block:

```json
// Before:
"views": {
  "cloudinary": [
    {
      "id": "cloudinaryMediaLibrary",
      "name": ""
    }
  ]
}

// After:
"views": {
  "cloudinary": [
    {
      "id": "cloudinaryHomescreen",
      "name": "Cloudinary",
      "type": "webview",
      "when": "cloudinary.activeView == 'homescreen'"
    },
    {
      "id": "cloudinaryMediaLibrary",
      "name": "",
      "when": "cloudinary.activeView == 'library'"
    }
  ]
}
```

- [ ] **Step 2: Add two new commands to the `commands` array**

Add after the `cloudinary.openWelcomeScreen` entry (before the closing `]` of the commands array):

```json
{
  "command": "cloudinary.showHomescreen",
  "title": "Go to Home",
  "icon": "$(home)",
  "category": "Cloudinary"
},
{
  "command": "cloudinary.showLibrary",
  "title": "Browse Media Library",
  "category": "Cloudinary"
}
```

- [ ] **Step 3: Add `$(home)` button to tree view title bar**

Add a new menu entry at the start of the `"view/title"` array (before the `cloudinary.refresh` entry):

```json
{
  "command": "cloudinary.showHomescreen",
  "when": "view == cloudinaryMediaLibrary",
  "group": "navigation@0"
}
```

- [ ] **Step 4: Verify JSON is valid and build succeeds**

```bash
npm run compile
```

Expected: build completes with no errors, `dist/extension.js` and `media/scripts/homescreen.js` are produced.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "feat: register homescreen view and navigation commands in package.json"
```

---

### Task 6: Wire up provider in `extension.ts`

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Add import at the top of `extension.ts`**

After the existing imports, add:

```typescript
import { HomescreenViewProvider } from "./webview/homescreenView";
```

- [ ] **Step 2: Set context and register provider in `activate()`**

Add immediately after `const cloudinaryProvider = new CloudinaryTreeDataProvider();` (line 40), before `const isFirstRun = ...`:

```typescript
// Set initial view to homescreen
vscode.commands.executeCommand("setContext", "cloudinary.activeView", "homescreen");

// Register homescreen sidebar view
const homescreenProvider = new HomescreenViewProvider(context.extensionUri, cloudinaryProvider);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider(
    HomescreenViewProvider.viewType,
    homescreenProvider,
    { webviewOptions: { retainContextWhenHidden: true } }
  )
);
```

- [ ] **Step 3: Verify type-check and full build**

```bash
npm run compile
```

Expected: no errors. `dist/extension.js` and `media/scripts/homescreen.js` are updated.

- [ ] **Step 4: Manual smoke test in VS Code**

Press `F5` in VS Code to launch the Extension Development Host. Verify:
1. The Cloudinary sidebar shows the homescreen dashboard (status card + three buttons + Welcome Guide link)
2. Clicking "Browse Library" switches to the tree view
3. The `$(home)` icon in the tree view title bar switches back to the homescreen
4. If credentials are unconfigured, the status card shows "Not Configured" with a "Configure" button

- [ ] **Step 5: Commit**

```bash
git add src/extension.ts
git commit -m "feat: wire up HomescreenViewProvider in extension activation"
```
