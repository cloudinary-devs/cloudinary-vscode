# Webview System

The extension uses a modular design system for building webview UIs. CSS is loaded from `media/styles/`, and browser-side TypeScript entry points are bundled into `media/scripts/` by `esbuild.js`.

## Architecture

```
src/webview/
├── client/                     # Browser-side TypeScript entry points
│   ├── common.ts               # Shared webview utilities
│   ├── homescreen.ts           # Homescreen sidebar client
│   ├── library.ts              # Media library sidebar client
│   ├── preview.ts              # Asset preview client
│   ├── upload-widget.ts        # Upload panel client
│   └── welcome.ts              # Welcome panel client
├── webviewUtils.ts             # HTML generation and CSP helpers
├── icons.ts                    # Centralized host-side SVG icons
└── utils/helpers.ts            # Shared utilities (escapeHtml, etc.)

media/
├── styles/                     # CSS loaded by webviews
│   ├── tokens.css              # Design tokens (CSS custom properties)
│   ├── base.css                # Reset, typography, utilities
│   ├── components.css          # Component styles
│   └── library.css             # Library-specific styling
└── scripts/                    # Built browser bundles from src/webview/client/
    ├── homescreen.js
    ├── library.js
    ├── preview.js
    ├── upload-widget.js
    └── welcome.js
```

## Creating a Webview

### Basic Structure

```typescript
import { createWebviewDocument, getScriptUri } from "../webview/webviewUtils";
import { escapeHtml } from "../webview/utils/helpers";
import { assetIcons, actionIcons } from "../webview/icons";

function openMyPanel(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "myPanelId",
    "My Panel Title",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "media"),
      ],
    }
  );

  // Optional: add a bundled client entry from media/scripts/.
  const myScriptUri = getScriptUri(panel.webview, context.extensionUri, "my-script.js");

  panel.webview.html = createWebviewDocument({
    title: "My Panel",
    webview: panel.webview,
    extensionUri: context.extensionUri,
    bodyContent: getMyContent(),
    bodyClass: "layout-centered",  // Optional
    additionalScripts: [myScriptUri],  // Optional
  });

  // Handle messages from webview
  panel.webview.onDidReceiveMessage((message) => {
    // Handle message
  });
}
```

### Key Points

1. **Bundle client behavior from `src/webview/client/`** and add the entry point to `esbuild.js`
2. **Call `initCommon()` from the client entry** when you need tabs, copy buttons, collapsibles, or lightbox behavior
3. **Use `escapeHtml()`** for any dynamic content
4. **Import icons** from the centralized module
5. **Specify `localResourceRoots`** to allow loading external files

## CSS Architecture

### Design Tokens (`tokens.css`)

CSS custom properties based on Cloudinary brand and VS Code theming:

```css
:root {
  /* Cloudinary Brand Colors */
  --cld-brand-blue: #3448C5;
  --cld-sky-blue: #0D9AFF;
  
  /* Semantic Colors (VS Code with Cloudinary fallbacks) */
  --color-accent: var(--vscode-textLink-foreground, var(--cld-sky-blue));
  --color-success: var(--vscode-testing-iconPassed, #60CFB7);
  --color-error: var(--vscode-testing-iconFailed, #FE5981);
  
  /* Surfaces */
  --color-surface: var(--vscode-editor-background);
  --color-surface-elevated: var(--vscode-editorWidget-background);
  --color-border: var(--vscode-editorWidget-border);
  
  /* Spacing */
  --space-sm: 0.5rem;
  --space-md: 0.75rem;
  --space-lg: 1rem;
  --space-xl: 1.5rem;
}
```

### Base Styles (`base.css`)

- CSS reset
- Typography defaults
- Flexbox utilities (`.flex`, `.items-center`, `.gap-md`)
- Spacing utilities (`.mt-lg`, `.mb-md`)
- Animations (`.animate-fade-in`)

### Component Styles (`components.css`)

Styles for all UI components:

| Component | Classes |
|-----------|---------|
| Buttons | `.btn`, `.btn--primary`, `.btn--secondary`, `.btn--sm` |
| Cards | `.card`, `.card--elevated`, `.card__header`, `.card__body` |
| Tabs | `.tabs`, `.tabs__nav`, `.tabs__btn`, `.tabs__content` |
| Inputs | `.input`, `.select`, `.form-group` |
| Progress | `.progress-bar`, `.upload-queue` |
| Badges | `.badge`, `.badge--success`, `.meta-tags` |
| Drop Zone | `.drop-zone`, `.drop-zone--active` |
| Lightbox | `.lightbox`, `.lightbox__content` |

## Client Script Architecture

### Common Client Module (`src/webview/client/common.ts`)

Shared functionality imported by webview client entries:

```typescript
import { initCommon, getVSCode } from "./common";

initCommon();
const vscode = getVSCode();
```

`initCommon()` initializes the VS Code API bridge plus shared tabs, copy buttons, collapsibles, and lightbox behavior. The module also exports helpers such as `copyToClipboard(...)`, `formatFileSize(...)`, and `truncateString(...)`.

### View-Specific Scripts

Each webview can have its own script:

| Script | Purpose | Init Function |
|--------|---------|---------------|
| `homescreen.js` | Sidebar homescreen and AI tools setup | (auto-init) |
| `library.js` | Sidebar media library browsing UI | (auto-init) |
| `preview.js` | Asset preview panel behavior | (auto-init) |
| `upload-widget.js` | File uploads, progress, presets | `initUploadWidget(config)` for server-provided config |
| `welcome.js` | Welcome screen interactions | (auto-init) |

### Initialization Pattern

```typescript
// src/webview/client/my-panel.ts
import { initCommon, getVSCode } from "./common";

initCommon();

document.getElementById("myButton")?.addEventListener("click", () => {
  getVSCode()?.postMessage({ command: "doSomething" });
});
```

Use `inlineScript` only when the extension host must pass runtime data into the already-loaded client bundle, as the upload panel does with `initUploadWidget({ ... })`.

## Content Security Policy

The `createWebviewDocument` function generates a secure CSP:

```
default-src 'none';
style-src ${webview.cspSource} 'unsafe-inline';
script-src ${webview.cspSource} 'nonce-${nonce}';
img-src ${webview.cspSource} https: data:;
font-src ${webview.cspSource};
```

- External CSS/JS loaded from `webview.cspSource`
- Inline scripts require the nonce
- Images allowed from HTTPS and data URIs

## Icons

Use the centralized icon module:

```typescript
import { assetIcons, actionIcons } from "../webview/icons";

// Asset type icons
assetIcons.image("lg")   // Large image icon
assetIcons.video("md")   // Medium video icon
assetIcons.file("sm")    // Small file icon

// Action icons
actionIcons.download("sm")
actionIcons.copy("md")
actionIcons.enlarge("md")
actionIcons.close("md")
```

Sizes: `sm` (16px), `md` (20px), `lg` (24px), `xl` (48px)

## Utility Functions

Import shared utilities:

```typescript
import { 
  escapeHtml,      // Escape HTML special characters
  formatFileSize,  // Format bytes (e.g., "2.4 MB")
  truncateString,  // Truncate with ellipsis
  generateId,      // Generate unique IDs
} from "../webview/utils/helpers";
```

## Component Examples

### Buttons

```html
<button class="btn btn--primary">Primary</button>
<button class="btn btn--secondary btn--sm">Small Secondary</button>
<button class="btn btn--copy" data-copy="text to copy">Copy</button>
```

### Cards

```html
<div class="card card--elevated">
  <div class="card__header">
    <h2>Title</h2>
  </div>
  <div class="card__body">
    Content here
  </div>
</div>
```

### Tabs

```html
<div class="tabs" role="tablist">
  <nav class="tabs__nav">
    <button class="tabs__btn active" data-tab="info" role="tab">Info</button>
    <button class="tabs__btn" data-tab="meta" role="tab">Metadata</button>
  </nav>
  <div class="tabs__content active" id="tab-info" role="tabpanel">
    Info content
  </div>
  <div class="tabs__content" id="tab-meta" role="tabpanel">
    Metadata content
  </div>
</div>
```

### Collapsibles

```html
<div class="collapsible">
  <div class="collapsible__header">
    <span class="collapsible__title">Advanced Options</span>
  </div>
  <div class="collapsible__content">
    Hidden content here
  </div>
</div>
```

### Form Groups

```html
<div class="form-group">
  <label class="form-group__label" for="myInput">Label</label>
  <input type="text" id="myInput" class="input" placeholder="Placeholder" />
  <div class="form-group__hint">Helper text</div>
</div>
```

### Info Rows

```html
<div class="info-row">
  <span class="info-row__label">File Size</span>
  <span class="info-row__value">2.4 MB</span>
</div>
```

## Webview Communication

### Extension → Webview

```typescript
panel.webview.postMessage({ 
  command: 'update', 
  data: { ... } 
});
```

### Webview → Extension

```javascript
// In webview
const vscode = acquireVsCodeApi();
vscode.postMessage({ 
  command: 'doSomething', 
  data: { ... } 
});

// In extension
panel.webview.onDidReceiveMessage((message) => {
  if (message.command === 'doSomething') {
    // Handle
  }
});
```

## Adding a New Component

1. **Add styles** to the relevant file in `media/styles/`
2. **Add TypeScript** (if needed) to `src/webview/client/`
3. **Add TypeScript generator** (if complex) to `src/webview/components/`
4. **Export** from `src/webview/components/index.ts`

## Debugging Webviews

1. Open Developer Tools: `Help → Toggle Developer Tools`
2. Select the webview iframe in Elements panel
3. Check Console for JavaScript errors
4. Inspect Network tab for failed resource loads
5. Verify CSP isn't blocking resources
