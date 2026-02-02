/**
 * Cloudinary VS Code Extension - Webview Design System
 * 
 * This module provides a consistent UI component library for building
 * webviews in the Cloudinary VS Code extension. It includes:
 * 
 * - Design tokens (colors, spacing, typography)
 * - Base styles (reset, typography, layout utilities)
 * - UI components (buttons, cards, tabs, inputs, etc.)
 * - Utility scripts (clipboard, messaging)
 * 
 * @example
 * ```typescript
 * import { getBaseStyles, getAllComponentStyles, createButton, createCard } from '../webview';
 * 
 * const html = `
 *   <style>
 *     ${getBaseStyles()}
 *     ${getAllComponentStyles()}
 *   </style>
 *   ${createCard({
 *     title: 'My Panel',
 *     content: createButton({ text: 'Click Me' })
 *   })}
 * `;
 * ```
 */

// Design tokens
export {
  tokens,
  colors,
  spacing,
  radius,
  fontSize,
  transitions,
  shadows,
  getCSSVariables,
} from "./tokens";

// Base styles
export {
  getBaseStyles,
  getResetStyles,
  getTypographyStyles,
  getLayoutStyles,
  getAnimationStyles,
} from "./baseStyles";

// All components
export * from "./components";

// Utility scripts
export * from "./utils";
import { escapeHtml } from "./utils/helpers";

// Icons
export {
  icons,
  assetIcons,
  actionIcons,
  uiIcons,
  getAssetTypeIcon,
  type IconSize,
} from "./icons";

// Webview-specific scripts
export {
  getUploadWidgetScript,
  getPreviewAssetScript,
  getWelcomeScreenScript,
} from "./scripts";

// Import for combined functions
import { getBaseStyles } from "./baseStyles";
import { getAllComponentStyles, getAllComponentScripts } from "./components";
import { getClipboardScript, getMessagingScript } from "./utils";

/**
 * Returns the complete stylesheet for a webview.
 * Combines base styles with all component styles.
 * 
 * @returns Complete CSS string for webview
 * 
 * @example
 * ```typescript
 * panel.webview.html = `
 *   <style>${getCompleteStyles()}</style>
 *   <body>...</body>
 * `;
 * ```
 */
export function getCompleteStyles(): string {
  return [getBaseStyles(), getAllComponentStyles()].join("\n");
}

/**
 * Returns all JavaScript needed for interactive components.
 * Includes clipboard handling, tab switching, drop zones, etc.
 * 
 * @returns Complete JavaScript string for webview
 * 
 * @example
 * ```typescript
 * panel.webview.html = `
 *   <script>${getCompleteScripts()}</script>
 * `;
 * ```
 */
export function getCompleteScripts(): string {
  return [
    getMessagingScript(),
    getClipboardScript(),
    getAllComponentScripts(),
  ].join("\n");
}

/**
 * Creates a complete HTML document for a webview panel.
 * 
 * @param options - Document configuration
 * @returns Complete HTML string
 * 
 * @example
 * ```typescript
 * panel.webview.html = createWebviewDocument({
 *   title: 'Upload to Cloudinary',
 *   body: createPanel({ content: '...' }),
 *   additionalStyles: '.custom { color: red; }',
 *   additionalScripts: 'console.log("Hello");'
 * });
 * ```
 */
export function createWebviewDocument(options: {
  /** Document title */
  title: string;
  /** Body content (HTML string) */
  body: string;
  /** Additional CSS to include */
  additionalStyles?: string;
  /** Additional JavaScript to include */
  additionalScripts?: string;
  /** Whether to include all component scripts (default: true) */
  includeScripts?: boolean;
}): string {
  const {
    title,
    body,
    additionalStyles = "",
    additionalScripts = "",
    includeScripts = true,
  } = options;

  const styles = getCompleteStyles();
  const scripts = includeScripts ? getCompleteScripts() : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(title)}</title>
      <style>
        ${styles}
        ${additionalStyles}
      </style>
    </head>
    <body>
      ${body}
      <script>
        ${scripts}
        ${additionalScripts}
      </script>
    </body>
    </html>
  `;
}

