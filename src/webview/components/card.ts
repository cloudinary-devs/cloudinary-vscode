/**
 * Card/Panel component for Cloudinary VS Code extension webviews.
 * Provides consistent container styling with optional header and footer.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Card configuration options.
 */
export interface CardOptions {
  /** Card body content (HTML string) */
  content: string;
  /** Optional header content */
  header?: string;
  /** Optional footer content */
  footer?: string;
  /** Card title (alternative to custom header) */
  title?: string;
  /** Visual style variant */
  variant?: "default" | "elevated" | "outlined";
  /** Whether the card should have full width */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Card ID */
  id?: string;
}

/**
 * Panel configuration options (full-width container variant).
 */
export interface PanelOptions {
  /** Panel body content (HTML string) */
  content: string;
  /** Panel title */
  title?: string;
  /** Maximum width constraint */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  /** Additional CSS classes */
  className?: string;
  /** Panel ID */
  id?: string;
}

/**
 * Returns CSS styles for card and panel components.
 */
export function getCardStyles(): string {
  return `
    /* ========================================
       Card Base Styles
       ======================================== */
    .card {
      background-color: var(--color-surface-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .card--elevated {
      box-shadow: var(--shadow-lg);
      border: none;
    }

    .card--outlined {
      background-color: transparent;
      border: 1px solid var(--color-border);
    }

    .card--full-width {
      width: 100%;
    }

    /* ========================================
       Card Header
       ======================================== */
    .card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      padding: var(--space-lg);
      border-bottom: 1px solid var(--color-border);
    }

    .card__title {
      margin: 0;
      font-size: var(--font-xl);
      font-weight: 600;
      color: var(--color-text);
    }

    .card__header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    /* ========================================
       Card Body
       ======================================== */
    .card__body {
      padding: var(--space-lg);
    }

    .card__body--flush {
      padding: 0;
    }

    /* ========================================
       Card Footer
       ======================================== */
    .card__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-sm);
      padding: var(--space-md) var(--space-lg);
      border-top: 1px solid var(--color-border);
      background-color: var(--color-surface);
    }

    /* ========================================
       Panel Styles (Full-width container)
       ======================================== */
    .panel {
      background-color: var(--color-surface-elevated);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg);
      padding: var(--space-xl);
      width: 100%;
    }

    .panel--sm { max-width: 400px; }
    .panel--md { max-width: 600px; }
    .panel--lg { max-width: 750px; }
    .panel--xl { max-width: 1000px; }
    .panel--full { max-width: 100%; }

    .panel__title {
      margin: 0 0 var(--space-lg) 0;
      font-size: var(--font-xl);
      font-weight: 600;
      color: var(--color-text);
    }

    /* ========================================
       Section Styles (Within cards/panels)
       ======================================== */
    .section {
      margin-bottom: var(--space-xl);
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section__title {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--space-sm);
    }

    /* ========================================
       Dividers
       ======================================== */
    .divider {
      height: 1px;
      background-color: var(--color-border);
      margin: var(--space-lg) 0;
      border: none;
    }

    .divider--vertical {
      width: 1px;
      height: auto;
      margin: 0 var(--space-md);
    }
  `;
}

/**
 * Creates a card HTML element.
 *
 * @param options - Card configuration
 * @returns HTML string for the card
 *
 * @example
 * ```typescript
 * createCard({
 *   title: 'Asset Info',
 *   content: '<p>Asset details here...</p>'
 * })
 *
 * createCard({
 *   header: '<h2>Custom Header</h2>',
 *   content: '<p>Content</p>',
 *   footer: '<button>Save</button>',
 *   variant: 'elevated'
 * })
 * ```
 */
export function createCard(options: CardOptions): string {
  const {
    content,
    header,
    footer,
    title,
    variant = "default",
    fullWidth = false,
    className = "",
    id,
  } = options;

  const classes = [
    "card",
    variant !== "default" ? `card--${variant}` : "",
    fullWidth ? "card--full-width" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const idAttr = id ? `id="${id}"` : "";

  // Build header section
  let headerHtml = "";
  if (header) {
    headerHtml = `<div class="card__header">${header}</div>`;
  } else if (title) {
    headerHtml = `<div class="card__header"><h2 class="card__title">${escapeHtml(title)}</h2></div>`;
  }

  // Build footer section
  const footerHtml = footer
    ? `<div class="card__footer">${footer}</div>`
    : "";

  return `
    <div class="${classes}" ${idAttr}>
      ${headerHtml}
      <div class="card__body">${content}</div>
      ${footerHtml}
    </div>
  `;
}

/**
 * Creates a panel HTML element (full-width container).
 *
 * @param options - Panel configuration
 * @returns HTML string for the panel
 *
 * @example
 * ```typescript
 * createPanel({
 *   title: 'Upload to Cloudinary',
 *   content: '<div>Upload form here...</div>',
 *   maxWidth: 'lg'
 * })
 * ```
 */
export function createPanel(options: PanelOptions): string {
  const {
    content,
    title,
    maxWidth = "lg",
    className = "",
    id,
  } = options;

  const classes = ["panel", `panel--${maxWidth}`, className]
    .filter(Boolean)
    .join(" ");

  const idAttr = id ? `id="${id}"` : "";

  const titleHtml = title
    ? `<h2 class="panel__title">${escapeHtml(title)}</h2>`
    : "";

  return `
    <div class="${classes}" ${idAttr}>
      ${titleHtml}
      ${content}
    </div>
  `;
}

/**
 * Creates a section within a card or panel.
 *
 * @param title - Section title
 * @param content - Section content (HTML string)
 * @returns HTML string for the section
 */
export function createSection(title: string, content: string): string {
  return `
    <div class="section">
      <div class="section__title">${escapeHtml(title)}</div>
      ${content}
    </div>
  `;
}

/**
 * Creates a horizontal divider.
 */
export function createDivider(): string {
  return '<hr class="divider" />';
}

