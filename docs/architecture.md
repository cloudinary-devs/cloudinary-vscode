# Architecture

The extension is a VS Code sidebar integration built around a shared `CloudinaryService` plus webview-based UI surfaces.

## Core Components

```text
┌─────────────────────────────────────────────────────────────┐
│                     VS Code Extension                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Homescreen   │  │   Library    │  │   Commands   │       │
│  │  Webview     │  │   Webview    │  │   & Panels   │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └────────────┬────┴────────────────┘               │
│                      │                                      │
│         ┌────────────▼────────────┐                        │
│         │    CloudinaryService    │                        │
│         │  State + API boundary   │                        │
│         └────────────┬────────────┘                        │
│                      │                                      │
├──────────────────────┼──────────────────────────────────────┤
│                      │                                      │
│         ┌────────────▼────────────┐                        │
│         │ Cloudinary SDK Adapter  │                        │
│         │  wraps Node SDK usage   │                        │
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

## Key Design Decisions

1. Configuration lives in Cloudinary environment files, not VS Code settings.
2. `CloudinaryService` owns runtime Cloudinary state such as credentials, folder mode, and upload presets.
3. The sidebar is webview-driven: `cloudinaryHomescreen` and `cloudinaryMediaLibrary` are both webview views.
4. Webview host code lives in `src/webview/*.ts`; browser-side behavior lives in `src/webview/client/*.ts`.
5. The Cloudinary SDK is wrapped behind `createCloudinarySdkAdapter()` so service logic stays testable.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript (strict mode) |
| Build | esbuild |
| Runtime | VS Code Extension Host (Node.js) |
| API Client | Cloudinary Node.js SDK v2.x via adapter |
| Testing | Mocha + VS Code Test Electron |
| Linting | ESLint |

## Data Flow

### Activation and Configuration

```text
1. Extension activates
2. Load environments from .cloudinary/environments.json or ~/.cloudinary/environments.json
3. Validate credentials and configure the Cloudinary SDK
4. Detect folder mode and cache it in global state
5. Create shared CloudinaryService
6. Register homescreen and library webview providers
7. Register commands against the shared service/providers
```

### Library Loading

```text
1. Library webview posts "ready"
2. LibraryWebviewViewProvider reads current view state
3. Provider calls CloudinaryService for folders/assets/search results
4. Provider posts root/search/folder messages to the client
5. Client renders the virtualized tree/list UI
```

The library renders a compact header (brand strip, action toolbar, filter controls, and search field) above the virtualized list:

- **Brand strip** — Cloudinary logo, wordmark, and active cloud name pill. The pill is populated from the `envChanged` message posted on `ready` and on every environment switch.
- **Action toolbar** — icon-button groups for navigation, refresh, upload, and configuration. Search and filtering are not toolbar toggles; those controls remain visible below the toolbar.
- **Search and filter controls** — resource type, sort order, and search input stay visible so the core browse controls are always one interaction away.
- **Row grid** — every row is 22px tall with three uniform 18px slots (twistie · icon · spacer) so folders, assets, loading, and clear-search rows share an exact rhythm. Row content is flex-centered so glyphs and labels sit in the middle of the selection band.
- **Folder iconography** — separate closed (stroked outline) and open (filled, two-tone) glyphs so expand state reads from the icon as well as the chevron rotation.
- **Authenticated delivery** — assets with `type: authenticated` are marked with a lock in the list and preview. The service signs the original delivery URL and reuses it for preview fields instead of generating dynamic optimization/thumbnail transformations.
- **Hover preview** — narrow card with a brand-gradient hairline, 176×176 thumbnail, resource-type chip, and truncated caption. Smart left/right placement based on viewport edges.
- **Welcome empty state** — gradient-edged card shown when no credentials are configured; CTA button posts `runToolbar` `openGlobalConfig`.
- **Reduced motion** — all animations and transitions are disabled under `@media (prefers-reduced-motion: reduce)`.

### Webview Communication

```text
Extension host                     Webview client
     │                                  │
     │ webview.html = ...               │
     │─────────────────────────────────>│
     │                                  │
     │ postMessage({ command: ... })    │
     │─────────────────────────────────>│
     │                                  │
     │ onDidReceiveMessage(...)         │
     │<─────────────────────────────────│
```

The homescreen drives navigation and search entry points. The library handles browsing, filtering, sorting, selection, context actions, and scroll state.

Both webview view providers route outbound messages through a defensive `safePost` helper that swallows `Webview is disposed` errors. This protects against late callbacks (search prefetches, upload progress, env-change refreshes) firing after a view collapses or the user dismisses an editor panel.

## VS Code Integration Points

### `package.json` Contributions

| Contribution | Purpose |
|--------------|---------|
| `viewsContainers.activitybar` | Cloudinary icon in the activity bar |
| `views.cloudinary` | Registers the homescreen and library webview views |
| `commands` | Command definitions used by webviews and panels |

Most toolbar and context actions are now implemented inside the library webview rather than through `contributes.menus`.

## Error Handling

Cloudinary-facing failures should go through `handleCloudinaryError()`:

```typescript
import { handleCloudinaryError } from "../utils/cloudinaryErrorHandler";

try {
  await cloudinaryService.searchAssets("hero");
} catch (err: any) {
  handleCloudinaryError("Failed to search assets", err);
}
```

The handler normalizes Cloudinary SDK errors and surfaces user-facing actions for common credential problems.
