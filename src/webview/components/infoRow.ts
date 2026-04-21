/**
 * Info row component for Cloudinary VS Code extension webviews.
 * Displays label-value pairs in a consistent format.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Info row configuration options.
 */
export interface InfoRowOptions {
  /** Label text */
  label: string;
  /** Value content (can be HTML) */
  value: string;
  /** Whether the value is copyable */
  copyable?: boolean;
  /** Copy button text */
  copyText?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * URL item configuration (special case of info row for URLs).
 */
export interface UrlItemOptions {
  /** URL label */
  label: string;
  /** URL value */
  url: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Returns CSS styles for info row components.
 */
export function getInfoRowStyles(): string {
  return `
    /* ========================================
       Info Row (Label + Value)
       ======================================== */
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--space-sm) 0;
      border-bottom: 1px solid var(--color-border);
      font-size: var(--font-md);
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-row__label {
      color: var(--color-text-muted);
      font-weight: 500;
      flex-shrink: 0;
    }

    .info-row__value {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      text-align: right;
      word-break: break-all;
      max-width: 60%;
    }

    .info-row__value--full {
      max-width: none;
      flex: 1;
    }

    /* ========================================
       URL Item (Clickable URL row)
       ======================================== */
    .url-item {
      margin-bottom: var(--space-md);
      padding: var(--space-md);
      background-color: var(--color-surface);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
    }

    .url-item:last-child {
      margin-bottom: 0;
    }

    .url-item__label {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: var(--space-xs);
    }

    .url-item__value {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .url-item__link {
      flex: 1;
      font-size: var(--font-sm);
      color: var(--color-accent);
      text-decoration: none;
      word-break: break-all;
    }

    .url-item__link:hover {
      text-decoration: underline;
    }

    /* ========================================
       Info List (Container for multiple rows)
       ======================================== */
    .info-list {
      display: flex;
      flex-direction: column;
    }

    .info-list--compact .info-row {
      padding: var(--space-xs) 0;
    }

    /* ========================================
       Key-Value Grid (Alternative layout)
       ======================================== */
    .kv-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-sm) var(--space-lg);
      align-items: baseline;
    }

    .kv-grid__key {
      color: var(--color-text-muted);
      font-weight: 500;
      font-size: var(--font-sm);
    }

    .kv-grid__value {
      font-size: var(--font-sm);
      word-break: break-word;
    }
  `;
}

/**
 * Creates an info row HTML element.
 *
 * @param options - Info row configuration
 * @returns HTML string for the info row
 *
 * @example
 * ```typescript
 * createInfoRow({ label: 'File Size', value: '2.4 MB' })
 *
 * createInfoRow({
 *   label: 'Public ID',
 *   value: 'my-image',
 *   copyable: true,
 *   copyText: 'Copy'
 * })
 * ```
 */
export function createInfoRow(options: InfoRowOptions): string {
  const {
    label,
    value,
    copyable = false,
    copyText = "Copy",
    className = "",
  } = options;

  const rowClasses = ["info-row", className].filter(Boolean).join(" ");

  const copyButton = copyable
    ? `<button class="btn btn--secondary btn--sm btn--copy" data-copy="${escapeHtml(value)}">${escapeHtml(copyText)}</button>`
    : "";

  return `
    <div class="${rowClasses}">
      <span class="info-row__label">${escapeHtml(label)}</span>
      <span class="info-row__value">
        <span>${value}</span>
        ${copyButton}
      </span>
    </div>
  `;
}

/**
 * Creates a URL item HTML element.
 *
 * @param options - URL item configuration
 * @returns HTML string for the URL item
 *
 * @example
 * ```typescript
 * createUrlItem({
 *   label: 'Original URL',
 *   url: 'https://res.cloudinary.com/...'
 * })
 * ```
 */
export function createUrlItem(options: UrlItemOptions): string {
  const { label, url, className = "" } = options;

  const itemClasses = ["url-item", className].filter(Boolean).join(" ");

  return `
    <div class="${itemClasses}">
      <div class="url-item__label">${escapeHtml(label)}</div>
      <div class="url-item__value">
        <a href="${escapeHtml(url)}" target="_blank" class="url-item__link">${escapeHtml(url)}</a>
        <button class="btn btn--secondary btn--sm btn--copy" data-copy="${escapeHtml(url)}">Copy</button>
      </div>
    </div>
  `;
}

/**
 * Creates a list of info rows.
 *
 * @param items - Array of info row options
 * @param compact - Whether to use compact spacing
 * @returns HTML string for the info list
 */
export function createInfoList(
  items: InfoRowOptions[],
  compact = false
): string {
  const listClasses = ["info-list", compact ? "info-list--compact" : ""]
    .filter(Boolean)
    .join(" ");

  const rowsHtml = items.map((item) => createInfoRow(item)).join("");

  return `<div class="${listClasses}">${rowsHtml}</div>`;
}

/**
 * Creates a key-value grid layout.
 *
 * @param items - Array of key-value pairs
 * @returns HTML string for the key-value grid
 *
 * @example
 * ```typescript
 * createKeyValueGrid([
 *   { key: 'Format', value: 'PNG' },
 *   { key: 'Size', value: '1024x768' },
 * ])
 * ```
 */
export function createKeyValueGrid(
  items: { key: string; value: string }[]
): string {
  const itemsHtml = items
    .map(
      (item) => `
      <div class="kv-grid__key">${escapeHtml(item.key)}</div>
      <div class="kv-grid__value">${item.value}</div>
    `
    )
    .join("");

  return `<div class="kv-grid">${itemsHtml}</div>`;
}

