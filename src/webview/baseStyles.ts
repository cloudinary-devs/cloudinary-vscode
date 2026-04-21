/**
 * Base styles for Cloudinary VS Code extension webviews.
 * Includes CSS reset, typography, and foundational styles.
 */

import { getCSSVariables } from "./tokens";

/**
 * CSS reset and normalization styles.
 * Ensures consistent rendering across different VS Code themes.
 */
export function getResetStyles(): string {
  return `
    /* Box sizing reset */
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    /* Remove default margins */
    * {
      margin: 0;
    }

    /* Improve text rendering */
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Improve media defaults */
    img,
    picture,
    video,
    canvas,
    svg {
      display: block;
      max-width: 100%;
    }

    /* Remove built-in form typography styles */
    input,
    button,
    textarea,
    select {
      font: inherit;
    }

    /* Avoid text overflows */
    p,
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      overflow-wrap: break-word;
    }
  `;
}

/**
 * Base body and typography styles.
 */
export function getTypographyStyles(): string {
  return `
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--font-md);
      background-color: var(--color-surface);
      color: var(--color-text);
      line-height: 1.6;
      padding: var(--space-lg);
    }

    /* Headings */
    h1, h2, h3, h4, h5, h6 {
      color: var(--color-text);
      font-weight: 600;
      line-height: 1.3;
    }

    h1 { font-size: 1.5rem; }
    h2 { font-size: var(--font-xxl); }
    h3 { font-size: var(--font-xl); }
    h4 { font-size: var(--font-lg); }

    /* Paragraphs */
    p {
      margin-bottom: var(--space-md);
      color: var(--color-text-muted);
    }

    p:last-child {
      margin-bottom: 0;
    }

    /* Links */
    a {
      color: var(--color-accent);
      text-decoration: none;
      cursor: pointer;
    }

    a:hover {
      text-decoration: underline;
    }

    /* Code */
    code {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 0.1rem 0.35rem;
      border-radius: var(--radius-sm);
    }

    pre {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--font-sm);
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-lg);
      overflow-x: auto;
      white-space: pre-wrap;
    }

    /* Lists */
    ul, ol {
      padding-left: var(--space-xl);
      margin-bottom: var(--space-md);
    }

    li {
      margin-bottom: var(--space-xs);
    }

    /* Strong/emphasis */
    strong {
      font-weight: 600;
      color: var(--color-text);
    }

    em {
      font-style: italic;
    }

    /* Small text */
    small,
    .text-small {
      font-size: var(--font-sm);
    }

    .text-xs {
      font-size: var(--font-xs);
    }

    /* Muted text */
    .text-muted {
      color: var(--color-text-muted);
    }

    /* Truncate text */
    .truncate {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
}

/**
 * Layout utility classes.
 */
export function getLayoutStyles(): string {
  return `
    /* Flexbox utilities */
    .flex {
      display: flex;
    }

    .flex-col {
      flex-direction: column;
    }

    .flex-wrap {
      flex-wrap: wrap;
    }

    .items-center {
      align-items: center;
    }

    .items-start {
      align-items: flex-start;
    }

    .justify-center {
      justify-content: center;
    }

    .justify-between {
      justify-content: space-between;
    }

    .flex-1 {
      flex: 1;
    }

    /* Gap utilities */
    .gap-xs { gap: var(--space-xs); }
    .gap-sm { gap: var(--space-sm); }
    .gap-md { gap: var(--space-md); }
    .gap-lg { gap: var(--space-lg); }
    .gap-xl { gap: var(--space-xl); }

    /* Grid utilities */
    .grid {
      display: grid;
    }

    .grid-cols-2 {
      grid-template-columns: repeat(2, 1fr);
    }

    .grid-cols-auto {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }

    /* Spacing utilities */
    .m-0 { margin: 0; }
    .mt-sm { margin-top: var(--space-sm); }
    .mt-md { margin-top: var(--space-md); }
    .mt-lg { margin-top: var(--space-lg); }
    .mb-sm { margin-bottom: var(--space-sm); }
    .mb-md { margin-bottom: var(--space-md); }
    .mb-lg { margin-bottom: var(--space-lg); }

    .p-0 { padding: 0; }
    .p-sm { padding: var(--space-sm); }
    .p-md { padding: var(--space-md); }
    .p-lg { padding: var(--space-lg); }

    /* Width utilities */
    .w-full { width: 100%; }
    .max-w-sm { max-width: 400px; }
    .max-w-md { max-width: 600px; }
    .max-w-lg { max-width: 750px; }
    .max-w-xl { max-width: 1000px; }

    /* Visibility */
    .hidden {
      display: none !important;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;
}

/**
 * Animation utilities.
 */
export function getAnimationStyles(): string {
  return `
    /* Fade in animation */
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .animate-fade-in {
      animation: fadeIn var(--transition-slow) ease-out;
    }

    /* Spin animation for loaders */
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .animate-spin {
      animation: spin 1s linear infinite;
    }

    /* Pulse animation */
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .animate-pulse {
      animation: pulse 2s ease-in-out infinite;
    }
  `;
}

/**
 * Generates the complete base stylesheet.
 * Combines CSS variables, reset, typography, layout, and animations.
 *
 * @returns Complete base CSS string
 */
export function getBaseStyles(): string {
  return [
    getCSSVariables(),
    getResetStyles(),
    getTypographyStyles(),
    getLayoutStyles(),
    getAnimationStyles(),
  ].join("\n");
}

export default getBaseStyles;
