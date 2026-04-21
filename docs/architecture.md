# Architecture

The extension is built on VS Code's extension API and integrates with Cloudinary's Admin and Upload APIs.

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Extension                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Tree View   │  │   Webviews   │  │   Commands   │       │
│  │  (Sidebar)   │  │  (Panels)    │  │  (Actions)   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └────────────┬────┴────────────────┘               │
│                      │                                      │
│         ┌────────────▼────────────┐                        │
│         │  CloudinaryTreeProvider │                        │
│         │  (State & API Layer)    │                        │
│         └────────────┬────────────┘                        │
│                      │                                      │
├──────────────────────┼──────────────────────────────────────┤
│                      │                                      │
│         ┌────────────▼────────────┐                        │
│         │    Cloudinary SDK       │                        │
│         │    (Node.js v2)         │                        │
│         └────────────┬────────────┘                        │
│                      │                                      │
└──────────────────────┼──────────────────────────────────────┘
                       │
           ┌───────────▼───────────┐
           │   Cloudinary APIs     │
           │  - Admin API          │
           │  - Search API         │
           │  - Upload API         │
           └───────────────────────┘
```

### Key Design Decisions

1. **Configuration via files, not settings** - API secrets are stored in `~/.cloudinary/environments.json`, not VS Code settings (which could be committed to repos)

2. **Singleton provider** - `CloudinaryTreeDataProvider` holds all state and manages API calls

3. **External CSS/JS for webviews** - Styles and scripts are loaded from files, not embedded in HTML strings

4. **Centralized icons** - SVG icons are defined once in `src/webview/icons.ts`

5. **Shared utilities** - Common functions like `escapeHtml` are in `src/webview/utils/helpers.ts`

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript (strict mode) |
| Build | esbuild |
| Runtime | VS Code Extension Host (Node.js) |
| API Client | Cloudinary Node.js SDK v2.x |
| Testing | Mocha + VS Code Test Electron |
| Linting | ESLint |

## Data Flow

### Configuration Loading

```
1. Extension activates
2. Check for workspace config (.cloudinary/environments.json)
3. Fall back to global config (~/.cloudinary/environments.json)
4. Validate credentials (reject placeholder values)
5. Configure Cloudinary SDK
6. Detect folder mode (dynamic vs fixed)
```

### Tree View Population

```
1. VS Code calls provider.getChildren()
2. Provider checks cache (assetMap)
3. If not cached, fetch from API
4. Transform to CloudinaryItem instances
5. Return items to VS Code
```

### Webview Communication

```
Extension                          Webview
    │                                  │
    │  panel.webview.html = ...        │
    │──────────────────────────────────>│
    │                                  │
    │  vscode.postMessage({...})       │
    │<──────────────────────────────────│
    │                                  │
    │  panel.webview.postMessage({...})│
    │──────────────────────────────────>│
    │                                  │
```

## VS Code Integration Points

### Package.json Contributions

| Contribution | Purpose |
|--------------|---------|
| `viewsContainers.activitybar` | Cloudinary icon in sidebar |
| `views.cloudinary` | Tree view registration |
| `commands` | Command definitions |
| `menus.view/title` | Tree view title bar buttons |
| `menus.view/item/context` | Right-click context menu |

### Tree Item Context Values

| Context Value | Description |
|---------------|-------------|
| `asset` | Media file (enables copy commands) |
| `folder` | Directory (enables upload to folder) |
| `loadMore` | Pagination trigger |
| `clearSearch` | Clear search results |

## Error Handling

All Cloudinary API errors flow through `handleCloudinaryError()`:

```typescript
import { handleCloudinaryError } from '../utils/cloudinaryErrorHandler';

try {
  await cloudinary.search.execute();
} catch (err: any) {
  handleCloudinaryError('Failed to search assets', err);
}
```

The handler:
1. Extracts message from various error formats
2. Shows VS Code error notification
3. Offers "Open Global Config" action for credential errors
