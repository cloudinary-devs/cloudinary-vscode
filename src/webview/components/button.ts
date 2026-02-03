/**
 * Button component for Cloudinary VS Code extension webviews.
 * Provides consistent button styling with multiple variants and sizes.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Button configuration options.
 */
export interface ButtonOptions {
  /** Button text content */
  text: string;
  /** Visual style variant */
  variant?: "primary" | "secondary" | "ghost";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Inline onclick handler (JavaScript string) */
  onClick?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Data attribute for copy functionality */
  dataCopy?: string;
  /** Button type attribute */
  type?: "button" | "submit" | "reset";
  /** Title/tooltip text */
  title?: string;
  /** Button ID */
  id?: string;
}

/**
 * Icon button configuration options.
 */
export interface IconButtonOptions {
  /** SVG icon content (raw SVG string) */
  icon: string;
  /** Accessible label for screen readers */
  ariaLabel: string;
  /** Visual style variant */
  variant?: "primary" | "secondary" | "ghost";
  /** Button size */
  size?: "sm" | "md" | "lg";
  /** Inline onclick handler */
  onClick?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Title/tooltip text */
  title?: string;
  /** Button ID */
  id?: string;
}

/**
 * Returns CSS styles for button components.
 */
export function getButtonStyles(): string {
  return `
    /* ========================================
       Button Base Styles
       ======================================== */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-sm);
      font-family: inherit;
      font-size: var(--font-md);
      font-weight: 500;
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
      border: none;
      border-radius: var(--radius-sm);
      padding: 0.6rem 1.25rem;
      transition: 
        background-color var(--transition-normal),
        color var(--transition-normal),
        border-color var(--transition-normal),
        opacity var(--transition-normal);
    }

    .btn:focus-visible {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ========================================
       Button Variants
       ======================================== */
    
    /* Primary button - main actions */
    .btn--primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .btn--primary:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }

    /* Secondary button - alternative actions */
    .btn--secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .btn--secondary:hover:not(:disabled) {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    /* Ghost button - minimal visual weight */
    .btn--ghost {
      background-color: transparent;
      color: var(--color-accent);
    }

    .btn--ghost:hover:not(:disabled) {
      background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }

    /* ========================================
       Button Sizes
       ======================================== */
    
    .btn--sm {
      font-size: var(--font-sm);
      padding: 0.3rem 0.6rem;
    }

    .btn--md {
      font-size: var(--font-md);
      padding: 0.6rem 1.25rem;
    }

    .btn--lg {
      font-size: var(--font-lg);
      padding: 0.75rem 1.5rem;
    }

    /* ========================================
       Special Button Types
       ======================================== */
    
    /* Copy button - shows "Copied!" feedback */
    .btn--copy.copied {
      background-color: var(--color-success) !important;
      color: white !important;
    }

    /* Icon-only button */
    .btn--icon {
      padding: 0.5rem;
      border-radius: var(--radius-md);
    }

    .btn--icon svg {
      width: 18px;
      height: 18px;
    }

    .btn--icon.btn--sm svg {
      width: 14px;
      height: 14px;
    }

    .btn--icon.btn--lg svg {
      width: 22px;
      height: 22px;
    }

    /* ========================================
       Button Groups
       ======================================== */
    
    .btn-group {
      display: flex;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }

    .btn-group--vertical {
      flex-direction: column;
      align-items: flex-start;
    }
  `;
}

/**
 * Creates a button HTML element.
 *
 * @param options - Button configuration
 * @returns HTML string for the button
 *
 * @example
 * ```typescript
 * createButton({ text: 'Upload', variant: 'primary' })
 * // <button class="btn btn--primary btn--md">Upload</button>
 *
 * createButton({ text: 'Copy', dataCopy: 'https://...', className: 'btn--copy' })
 * // <button class="btn btn--primary btn--md btn--copy" data-copy="https://...">Copy</button>
 * ```
 */
export function createButton(options: ButtonOptions): string {
  const {
    text,
    variant = "primary",
    size = "md",
    onClick,
    disabled = false,
    className = "",
    dataCopy,
    type = "button",
    title,
    id,
  } = options;

  const classes = ["btn", `btn--${variant}`, `btn--${size}`, className]
    .filter(Boolean)
    .join(" ");

  const attributes: string[] = [
    `class="${classes}"`,
    `type="${type}"`,
  ];

  if (id) {
    attributes.push(`id="${id}"`);
  }
  if (disabled) {
    attributes.push("disabled");
  }
  if (onClick) {
    attributes.push(`onclick="${onClick}"`);
  }
  if (dataCopy) {
    attributes.push(`data-copy="${escapeHtml(dataCopy)}"`);
  }
  if (title) {
    attributes.push(`title="${escapeHtml(title)}"`);
  }

  return `<button ${attributes.join(" ")}>${escapeHtml(text)}</button>`;
}

/**
 * Creates an icon-only button HTML element.
 *
 * @param options - Icon button configuration
 * @returns HTML string for the icon button
 *
 * @example
 * ```typescript
 * createIconButton({
 *   icon: '<svg>...</svg>',
 *   ariaLabel: 'Close',
 *   variant: 'ghost'
 * })
 * ```
 */
export function createIconButton(options: IconButtonOptions): string {
  const {
    icon,
    ariaLabel,
    variant = "secondary",
    size = "md",
    onClick,
    disabled = false,
    className = "",
    title,
    id,
  } = options;

  const classes = [
    "btn",
    "btn--icon",
    `btn--${variant}`,
    `btn--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const attributes: string[] = [
    `class="${classes}"`,
    'type="button"',
    `aria-label="${escapeHtml(ariaLabel)}"`,
  ];

  if (id) {
    attributes.push(`id="${id}"`);
  }
  if (disabled) {
    attributes.push("disabled");
  }
  if (onClick) {
    attributes.push(`onclick="${onClick}"`);
  }
  if (title) {
    attributes.push(`title="${escapeHtml(title)}"`);
  }

  return `<button ${attributes.join(" ")}>${icon}</button>`;
}

/**
 * Creates a button group container.
 *
 * @param buttons - Array of button HTML strings
 * @param vertical - Whether to stack buttons vertically
 * @returns HTML string for the button group
 */
export function createButtonGroup(
  buttons: string[],
  vertical = false
): string {
  const classes = ["btn-group", vertical ? "btn-group--vertical" : ""]
    .filter(Boolean)
    .join(" ");

  return `<div class="${classes}">${buttons.join("")}</div>`;
}

