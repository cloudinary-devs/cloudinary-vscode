# Project Structure

This document describes the current organization of the Cloudinary VS Code extension after the move to webview-based sidebar views.

## Directory Overview

```text
cloudinary-vscode/
├── src/                        # TypeScript source code
│   ├── extension.ts            # Extension entry point
│   ├── cloudinary/             # Service layer and SDK adapter
│   ├── commands/               # Command registrations and handlers
│   ├── config/                 # Configuration utilities
│   ├── utils/                  # Shared utilities
│   ├── webview/                # Webview hosts, client code, and design system
│   └── test/                   # Test files
├── media/                      # Built webview CSS and JS assets
├── dist/                       # Bundled extension output
├── out/                        # TypeScript output for tests
├── docs/                       # Documentation
├── resources/                  # Static assets and icons
├── package.json                # Extension manifest
├── tsconfig.json               # TypeScript configuration
├── esbuild.js                  # Build script
└── .eslintrc.json              # ESLint configuration
```

## Source Code (`src/`)

### Entry Point

**`extension.ts`** initializes the shared runtime:

- creates `CloudinaryService`
- loads Cloudinary environment credentials
- detects folder mode
- registers `HomescreenViewProvider`
- registers `LibraryWebviewViewProvider`
- registers commands against the shared service and providers

### Cloudinary Layer (`src/cloudinary/`)

| File | Purpose |
|------|---------|
| `cloudinaryService.ts` | Shared Cloudinary state and high-level operations |
| `cloudinarySdkAdapter.ts` | Adapter that wraps the Cloudinary SDK |
| `types.ts` | Shared Cloudinary-facing types |

### Commands (`src/commands/`)

Each file exports a registration function.

| File | Commands | Purpose |
|------|----------|---------|
| `registerCommands.ts` | - | Central registration entry point |
| `previewAsset.ts` | `cloudinary.openAsset` | Asset preview panel |
| `uploadWidget.ts` | `cloudinary.openUploadWidget`, `cloudinary.uploadToFolder` | Upload panel |
| `welcomeScreen.ts` | `cloudinary.openWelcomeScreen` | Welcome/onboarding panel |
| `searchAssets.ts` | `cloudinary.searchAssets` | Focus homescreen search |
| `copyCommands.ts` | `cloudinary.copyPublicId`, `cloudinary.copyUrl`, `cloudinary.copyOptimizedUrl` | Clipboard operations |
| `switchEnvironment.ts` | `cloudinary.switchEnvironment` | Environment switching |
| `clearSearch.ts` | `cloudinary.clearSearch` | Clear library search |
| `viewOptions.ts` | `cloudinary.viewOptions` | Filter and sort library contents |
| `configureAiTools.ts` | `cloudinary.configureAiTools` | AI tools setup flow |

Command handlers now generally accept `CloudinaryService`, a narrow environment target, or a webview provider rather than a tree provider.

### Configuration (`src/config/`)

| File | Purpose |
|------|---------|
| `configUtils.ts` | Load and validate Cloudinary environment files |
| `detectFolderMode.ts` | Detect dynamic versus fixed folder mode |

### Utilities (`src/utils/`)

| File | Purpose |
|------|---------|
| `cloudinaryErrorHandler.ts` | Consistent Cloudinary error handling |
| `userAgent.ts` | Extension user-agent generation |

### Webview System (`src/webview/`)

The webview module now contains both sidebar views and the reusable UI system used by panels.

```text
src/webview/
├── homescreenView.ts           # Sidebar homescreen host
├── libraryView.ts              # Sidebar media library host
├── webviewUtils.ts             # HTML generation helpers
├── client/                     # Browser-side TypeScript
│   ├── homescreen.ts
│   ├── library.ts              # Library main client
│   ├── libraryIcons.ts         # SVG glyphs (duplicate of host icons.ts subset)
│   ├── libraryTypes.ts         # Duplicated message-protocol types
│   ├── libraryVirtualList.ts   # Virtualization math (22px row height)
│   ├── libraryRowSplice.ts     # Depth-aware splice helper
│   ├── libraryMenu.ts          # Context menu
│   ├── libraryHoverPreview.ts  # Hover thumbnail card with metadata
│   ├── preview.ts
│   ├── upload-widget.ts
│   └── welcome.ts
├── components/                 # Shared styles/helpers for webviews
├── utils/                      # Webview-side utilities
├── scripts/                    # Host-side script entry definitions
├── baseStyles.ts
├── icons.ts
├── index.ts
└── tokens.ts
```

`src/webview/client/` is bundled into `media/scripts/` by `esbuild.js`.

## Configuration Files

### `package.json`

Defines:

- extension metadata
- sidebar view contributions
- command contributions
- build and test scripts

The sidebar now contributes two webview views: `cloudinaryHomescreen` and `cloudinaryMediaLibrary`.

### `tsconfig.json`

TypeScript configuration for type checking and test compilation.

### `esbuild.js`

Bundles the extension entry point into `dist/extension.js` and builds the webview client assets into `media/`.

## Output Directories

### `dist/`

Bundled extension output used by VS Code.

### `out/`

Compiled test output used by the extension-host test runner.

### `media/`

Built JS and CSS consumed by webviews.

## Resources

### `resources/`

Static extension assets such as the Cloudinary icon.

## Key Patterns

### Command Registration

```typescript
function registerMyCommand(
  context: vscode.ExtensionContext,
  cloudinaryService: CloudinaryService
) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.myCommand", async () => {
      if (!cloudinaryService.cloudName) {
        return;
      }

      // Implementation
    })
  );
}
```

### Webview HTML Generation

```typescript
import {
  createWebviewDocument,
  getScriptUri,
  getStyleUri,
} from "../webview/webviewUtils";

view.webview.html = createWebviewDocument({
  title: "My View",
  webview: view.webview,
  extensionUri: context.extensionUri,
  bodyContent: `<div id="root"></div>`,
  additionalStyles: [getStyleUri(view.webview, context.extensionUri, "my-view.css")],
  additionalScripts: [getScriptUri(view.webview, context.extensionUri, "my-view.js")],
});
```

### Library Refresh

```typescript
await libraryWebview?.refresh();
```

Use provider methods instead of relying on removed tree-provider APIs.
