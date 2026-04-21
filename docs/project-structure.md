# Project Structure

This document explains the organization of the Cloudinary VS Code Extension codebase.

## Directory Overview

```
cloudinary-vscode/
├── src/                        # TypeScript source code
│   ├── extension.ts            # Extension entry point
│   ├── commands/               # Command implementations
│   ├── tree/                   # Tree view (sidebar)
│   ├── config/                 # Configuration utilities
│   ├── utils/                  # Shared utilities
│   ├── webview/                # Webview design system
│   └── test/                   # Test files
├── dist/                       # Bundled output (esbuild)
├── out/                        # TypeScript output (for tests)
├── docs/                       # Documentation
├── resources/                  # Static assets (icons)
├── package.json                # Extension manifest
├── tsconfig.json               # TypeScript configuration
├── esbuild.js                  # Build script
└── .eslintrc.json              # ESLint configuration
```

## Source Code (`src/`)

### Entry Point

**`extension.ts`** - Extension lifecycle management

- `activate()` - Called when extension starts
- Creates `CloudinaryTreeDataProvider`
- Loads configuration
- Registers commands and tree view

### Commands (`src/commands/`)

Each file exports a registration function:

| File | Commands | Purpose |
|------|----------|---------|
| `registerCommands.ts` | - | Central registration, imports all commands |
| `previewAsset.ts` | `cloudinary.openAsset` | Asset preview panel |
| `uploadWidget.ts` | `cloudinary.openUploadWidget`, `cloudinary.uploadToFolder` | Upload panel |
| `welcomeScreen.ts` | `cloudinary.showWelcome` | Welcome/onboarding screen |
| `searchAssets.ts` | `cloudinary.searchAssets` | Search by public ID |
| `copyCommands.ts` | `cloudinary.copyPublicId`, `cloudinary.copySecureUrl` | Clipboard operations |
| `switchEnvironment.ts` | `cloudinary.switchEnvironment` | Environment switching |
| `clearSearch.ts` | `cloudinary.clearSearch` | Clear search filter |
| `viewOptions.ts` | `cloudinary.setResourceFilter` | Filter by type |

### Tree View (`src/tree/`)

| File | Purpose |
|------|---------|
| `treeDataProvider.ts` | `TreeDataProvider` implementation, state management, API calls |
| `cloudinaryItem.ts` | `TreeItem` subclass for assets, folders, and UI elements |

**CloudinaryTreeDataProvider** holds:
- Credentials (`cloudName`, `apiKey`, `apiSecret`)
- View state (current folder, search query, filter)
- Asset cache (`assetMap`)
- Upload presets

### Configuration (`src/config/`)

| File | Purpose |
|------|---------|
| `configUtils.ts` | Load/validate configuration files |
| `detectFolderMode.ts` | Detect dynamic vs fixed folder mode |

### Utilities (`src/utils/`)

| File | Purpose |
|------|---------|
| `cloudinaryErrorHandler.ts` | Consistent error display with VS Code UI |
| `userAgent.ts` | Generate user agent for API calls |

### Webview System (`src/webview/`)

The webview module provides a design system for building consistent UIs:

```
src/webview/
├── index.ts                    # Public exports
├── tokens.ts                   # Design tokens (colors, spacing)
├── baseStyles.ts               # CSS reset, typography
├── icons.ts                    # Centralized SVG icons
├── webviewUtils.ts             # HTML generation helpers
├── components/                 # UI components
│   ├── index.ts                # Component exports
│   ├── button.ts               # Button styles
│   ├── card.ts                 # Card/panel styles
│   ├── tabs.ts                 # Tab navigation
│   ├── input.ts                # Form inputs
│   ├── dropZone.ts             # File upload drop zone
│   ├── progressBar.ts          # Progress indicators
│   ├── badge.ts                # Tags and badges
│   ├── infoRow.ts              # Key-value display
│   ├── lightbox.ts             # Image lightbox
│   └── layout.ts               # Layout components
├── utils/                      # Webview utilities
│   ├── index.ts                # Utility exports
│   ├── helpers.ts              # escapeHtml, formatFileSize, etc.
│   ├── clipboard.ts            # Clipboard functionality
│   └── messaging.ts            # VS Code API wrappers
├── scripts/                    # TypeScript for client-side JS
│   ├── index.ts
│   ├── uploadWidget.ts
│   ├── previewAsset.ts
│   └── welcomeScreen.ts
└── media/                      # External CSS/JS files
    ├── styles/
    │   ├── tokens.css          # CSS custom properties
    │   ├── base.css            # Base styles
    │   └── components.css      # Component styles
    └── scripts/
        ├── common.js           # Shared client-side utilities
        ├── upload-widget.js    # Upload panel functionality
        └── welcome.js          # Welcome screen functionality
```

See [Webview System](./webview-system.md) for detailed documentation.

## Configuration Files

### `package.json`

Extension manifest defining:
- Extension metadata (name, version, publisher)
- Activation events
- Contributed commands, views, and menus
- Dependencies

### `tsconfig.json`

TypeScript configuration:
- Strict mode enabled
- ES2022 target
- CommonJS modules (for VS Code)

### `esbuild.js`

Build configuration:
- Entry: `src/extension.ts`
- Output: `dist/extension.js`
- Externals: `vscode` module
- Source maps enabled

## Output Directories

### `dist/`

Production bundle created by esbuild:
- `extension.js` - Bundled extension code
- `extension.js.map` - Source map

### `out/`

TypeScript compilation output (for tests):
- Mirrors `src/` structure
- Used by test runner

## Resources

### `resources/`

Static assets:
- `cloudinary_icon_blue.png` - Extension icon
- `icon-image.svg`, `icon-video.svg`, `icon-file.svg` - Tree item icons

## Key Patterns

### Command Registration

```typescript
// src/commands/myCommand.ts
function registerMyCommand(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.myCommand", async () => {
      // Implementation
    })
  );
}
export default registerMyCommand;
```

### Tree Item Creation

```typescript
new CloudinaryItem(
  'Label',
  vscode.TreeItemCollapsibleState.Collapsed,
  'folder',  // type
  { path: '/products' },  // data
  cloudName,
  dynamicFolders
);
```

### Webview HTML Generation

```typescript
import { createWebviewDocument, getScriptUri } from "../webview/webviewUtils";

panel.webview.html = createWebviewDocument({
  title: "My Panel",
  webview: panel.webview,
  extensionUri: context.extensionUri,
  bodyContent: getHtmlContent(),
  additionalScripts: [getScriptUri(webview, extensionUri, "my-script.js")],
  inlineScript: "initCommon(); initMyPanel();",
});
```

