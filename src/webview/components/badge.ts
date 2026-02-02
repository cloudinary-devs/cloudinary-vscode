/**
 * Badge component for Cloudinary VS Code extension webviews.
 * Used for tags, status indicators, and labels.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Badge configuration options.
 */
export interface BadgeOptions {
  /** Badge text */
  text: string;
  /** Visual style variant */
  variant?: "default" | "primary" | "success" | "warning" | "error" | "info";
  /** Size variant */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tag configuration options (removable badge).
 */
export interface TagOptions {
  /** Tag text */
  text: string;
  /** Whether the tag is removable */
  removable?: boolean;
  /** Inline onclick handler for remove button */
  onRemove?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status indicator configuration.
 */
export interface StatusIndicatorOptions {
  /** Status state */
  status: "success" | "warning" | "error" | "info" | "pending";
  /** Label text */
  label?: string;
  /** Whether to show a pulsing animation */
  pulse?: boolean;
}

/**
 * Returns CSS styles for badge components.
 */
export function getBadgeStyles(): string {
  return `
    /* ========================================
       Badge Base
       ======================================== */
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-xs);
      font-weight: 600;
      padding: 0.15rem 0.5rem;
      border-radius: var(--radius-sm);
      white-space: nowrap;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .badge--md {
      font-size: var(--font-sm);
      padding: 0.25rem 0.75rem;
    }

    /* Badge variants */
    .badge--primary {
      background-color: var(--cld-sky-blue);
      color: white;
    }

    .badge--success {
      background-color: var(--color-success);
      color: white;
    }

    .badge--warning {
      background-color: var(--cld-pink);
      color: white;
    }

    .badge--error {
      background-color: var(--color-error);
      color: white;
    }

    .badge--info {
      background-color: var(--cld-turquoise);
      color: white;
    }

    /* Pill badge (larger radius) */
    .badge--pill {
      border-radius: 20px;
      padding: 0.25rem 0.75rem;
    }

    /* ========================================
       Tag (Badge with optional remove)
       ======================================== */
    .tag {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs);
      font-size: var(--font-sm);
      padding: 0.2rem 0.5rem;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: var(--radius-sm);
    }

    .tag__remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      padding: 0;
      margin-left: var(--space-xs);
      background: none;
      border: none;
      border-radius: var(--radius-full);
      color: inherit;
      cursor: pointer;
      opacity: 0.7;
      transition: opacity var(--transition-fast), background-color var(--transition-fast);
    }

    .tag__remove:hover {
      opacity: 1;
      background-color: rgba(0, 0, 0, 0.2);
    }

    /* ========================================
       Tag List
       ======================================== */
    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
    }

    .tag-list--compact {
      gap: 2px;
    }

    /* ========================================
       Status Indicator
       ======================================== */
    .status {
      display: inline-flex;
      align-items: center;
      gap: var(--space-sm);
      font-size: var(--font-sm);
    }

    .status__dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      flex-shrink: 0;
    }

    .status__dot--success { background-color: var(--color-success); }
    .status__dot--warning { background-color: var(--cld-pink); }
    .status__dot--error { background-color: var(--color-error); }
    .status__dot--info { background-color: var(--cld-turquoise); }
    .status__dot--pending { background-color: var(--color-text-muted); }

    .status__dot--pulse {
      animation: statusPulse 2s ease-in-out infinite;
    }

    @keyframes statusPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .status__label {
      color: var(--color-text);
    }

    /* ========================================
       Empty State
       ======================================== */
    .empty-state {
      color: var(--color-text-muted);
      font-size: var(--font-sm);
      font-style: italic;
    }
  `;
}

/**
 * Creates a badge HTML element.
 *
 * @param options - Badge configuration
 * @returns HTML string for the badge
 *
 * @example
 * ```typescript
 * createBadge({ text: 'NEW', variant: 'primary' })
 * createBadge({ text: 'PNG', variant: 'default' })
 * ```
 */
export function createBadge(options: BadgeOptions): string {
  const {
    text,
    variant = "default",
    size = "sm",
    className = "",
  } = options;

  const classes = [
    "badge",
    variant !== "default" ? `badge--${variant}` : "",
    size !== "sm" ? `badge--${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return `<span class="${classes}">${escapeHtml(text)}</span>`;
}

/**
 * Creates a tag HTML element with optional remove button.
 *
 * @param options - Tag configuration
 * @returns HTML string for the tag
 *
 * @example
 * ```typescript
 * createTag({ text: 'nature' })
 * createTag({ text: 'sunset', removable: true, onRemove: "removeTag('sunset')" })
 * ```
 */
export function createTag(options: TagOptions): string {
  const {
    text,
    removable = false,
    onRemove,
    className = "",
  } = options;

  const classes = ["tag", className].filter(Boolean).join(" ");

  const removeButton = removable
    ? `<button class="tag__remove" ${onRemove ? `onclick="${onRemove}"` : ""} aria-label="Remove ${escapeHtml(text)}">×</button>`
    : "";

  return `<span class="${classes}">${escapeHtml(text)}${removeButton}</span>`;
}

/**
 * Creates a list of tags.
 *
 * @param tags - Array of tag texts or tag options
 * @param compact - Whether to use compact spacing
 * @returns HTML string for the tag list
 *
 * @example
 * ```typescript
 * createTagList(['nature', 'sunset', 'landscape'])
 * createTagList([
 *   { text: 'nature', removable: true },
 *   { text: 'sunset', removable: true }
 * ])
 * ```
 */
export function createTagList(
  tags: (string | TagOptions)[],
  compact = false
): string {
  if (tags.length === 0) {
    return '<span class="empty-state">No tags</span>';
  }

  const listClasses = ["tag-list", compact ? "tag-list--compact" : ""]
    .filter(Boolean)
    .join(" ");

  const tagsHtml = tags
    .map((tag) =>
      typeof tag === "string" ? createTag({ text: tag }) : createTag(tag)
    )
    .join("");

  return `<div class="${listClasses}">${tagsHtml}</div>`;
}

/**
 * Creates a status indicator HTML element.
 *
 * @param options - Status indicator configuration
 * @returns HTML string for the status indicator
 *
 * @example
 * ```typescript
 * createStatusIndicator({ status: 'success', label: 'Connected' })
 * createStatusIndicator({ status: 'pending', label: 'Processing...', pulse: true })
 * ```
 */
export function createStatusIndicator(options: StatusIndicatorOptions): string {
  const { status, label, pulse = false } = options;

  const dotClasses = [
    "status__dot",
    `status__dot--${status}`,
    pulse ? "status__dot--pulse" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const labelHtml = label
    ? `<span class="status__label">${escapeHtml(label)}</span>`
    : "";

  return `
    <span class="status">
      <span class="${dotClasses}"></span>
      ${labelHtml}
    </span>
  `;
}

