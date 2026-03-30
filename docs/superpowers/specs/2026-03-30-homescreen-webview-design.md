# Homescreen WebviewView — Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Overview

Add a minimal dashboard "homescreen" as a `WebviewView` in the Cloudinary sidebar. It occupies the same space as the tree view and is replaced by it when the user clicks "Browse Library". This is the foundation for future features: guided MCP server installation, a chat panel, and eventual retirement of the existing welcome screen panel.

## Architecture

Two views are registered in the `cloudinary` activity bar container in `package.json`. A VS Code context variable `cloudinary.activeView` (value: `'homescreen'` or `'library'`) controls which one is visible via `when` clauses:

```json
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

On activation, `extension.ts` sets `cloudinary.activeView` to `'homescreen'`. No persistent state — every VS Code session starts on the homescreen.

The existing first-run welcome panel logic (`cloudinary.firstRun` globalState) is left unchanged.

## Homescreen Content

`HomescreenViewProvider` in `src/webview/homescreenView.ts` implements `vscode.WebviewViewProvider`. It receives the `CloudinaryTreeDataProvider` to read connection state.

Layout (top to bottom in the narrow sidebar):

1. **Connection status card** — shows cloud name when configured, or an "unconfigured" warning with a "Configure" button that fires `cloudinary.openGlobalConfig`
2. **Quick action buttons** (stacked vertically):
   - "Browse Library" → fires `cloudinary.showLibrary`
   - "Upload" → fires `cloudinary.openUploadWidget`
   - "Search" → fires `cloudinary.searchAssets`
3. **Footer** — "Welcome Guide" link that fires `cloudinary.openWelcomeScreen` (temporary, until the welcome screen is retired)

Styling uses the existing design system (`createWebviewDocument`, VS Code CSS variables via `--vscode-*`, component library from `src/webview/`).

## Navigation & State

Two new commands:

| Command | Action |
|---|---|
| `cloudinary.showHomescreen` | Sets context `cloudinary.activeView` = `'homescreen'` |
| `cloudinary.showLibrary` | Sets context `cloudinary.activeView` = `'library'`, then focuses the sidebar |

The tree view title bar gets a `$(home)` icon button wired to `cloudinary.showHomescreen` at `navigation@0`, allowing users to return to the homescreen from the library.

## Files

**New:**
- `src/webview/homescreenView.ts` — `HomescreenViewProvider` (WebviewViewProvider)
- `src/webview/client/homescreen.ts` — client-side message handlers
- `src/webview/scripts/homescreen.ts` — exports `getHomescreenScript()`

**Modified:**
- `package.json` — homescreen view, two new commands, `$(home)` tree title menu entry
- `src/extension.ts` — set initial context, register `HomescreenViewProvider`
- `src/commands/registerCommands.ts` — register `showHomescreen` and `showLibrary`
- `src/webview/scripts/index.ts` — export `getHomescreenScript`
- `esbuild.js` — add `homescreen.ts` as a client script entry point

## Future Considerations

- The welcome screen panel (`cloudinaryWelcome`) will be retired once the homescreen grows to cover its content (MCP setup guide, resources, etc.)
- The homescreen WebviewView is the intended host for guided MCP server installation and a future chat panel
- The `cloudinary.activeView` context variable can be extended to additional named views as the hub grows
