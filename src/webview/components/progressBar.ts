/**
 * Progress bar component for Cloudinary VS Code extension webviews.
 * Used primarily in the upload widget for tracking upload progress.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Progress bar configuration options.
 */
export interface ProgressBarOptions {
  /** Current progress percentage (0-100) */
  percent?: number;
  /** Visual state of the progress bar */
  state?: "default" | "success" | "error";
  /** Whether to show the percentage text */
  showText?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional CSS classes */
  className?: string;
  /** Progress bar ID */
  id?: string;
}

/**
 * Queue item configuration (progress bar with file name).
 */
export interface QueueItemOptions {
  /** Unique file identifier */
  fileId: string;
  /** File name to display */
  fileName: string;
  /** Current progress percentage */
  percent?: number;
  /** Current status */
  status?: "pending" | "uploading" | "complete" | "error";
  /** Error message (when status is error) */
  errorMessage?: string;
}

/**
 * Returns CSS styles for progress bar components.
 */
export function getProgressBarStyles(): string {
  return `
    /* ========================================
       Progress Bar Base
       ======================================== */
    .progress {
      width: 100%;
      height: 6px;
      background-color: var(--vscode-progressBar-background, rgba(0, 120, 212, 0.2));
      border-radius: 3px;
      overflow: hidden;
    }

    .progress--sm { height: 4px; }
    .progress--md { height: 6px; }
    .progress--lg { height: 8px; }

    .progress__bar {
      height: 100%;
      background-color: var(--vscode-progressBar-foreground, #0078d4);
      border-radius: 3px;
      transition: width var(--transition-normal) ease-out;
    }

    /* Progress states */
    .progress--success .progress__bar {
      background-color: var(--color-success);
    }

    .progress--error .progress__bar {
      background-color: var(--color-error);
    }

    /* ========================================
       Progress with Text
       ======================================== */
    .progress-labeled {
      display: flex;
      align-items: center;
      gap: var(--space-md);
    }

    .progress-labeled .progress {
      flex: 1;
    }

    .progress-labeled__text {
      font-size: var(--font-sm);
      color: var(--color-text-muted);
      min-width: 3rem;
      text-align: right;
    }

    /* ========================================
       Upload Queue Item
       ======================================== */
    .queue-item {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      padding: 0.6rem 0.75rem;
      background: var(--color-surface);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border);
      margin-bottom: var(--space-sm);
    }

    .queue-item:last-child {
      margin-bottom: 0;
    }

    .queue-item__name {
      flex-shrink: 0;
      max-width: 200px;
      font-size: var(--font-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .queue-item__progress {
      flex: 1;
      min-width: 100px;
    }

    .queue-item__status {
      flex-shrink: 0;
      font-size: var(--font-sm);
      color: var(--color-text-muted);
      min-width: 80px;
      text-align: right;
    }

    /* Queue item states */
    .queue-item--complete .progress__bar {
      background-color: var(--color-success);
    }

    .queue-item--complete .queue-item__status {
      color: var(--color-success);
    }

    .queue-item--error .progress__bar {
      background-color: var(--color-error);
    }

    .queue-item--error .queue-item__status {
      color: var(--color-error);
    }

    /* ========================================
       Upload Queue Container
       ======================================== */
    .upload-queue {
      margin-top: var(--space-lg);
    }

    .upload-queue:empty {
      display: none;
    }

    .upload-queue__title {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--color-text-muted);
      margin-bottom: var(--space-sm);
    }
  `;
}

/**
 * Creates a progress bar HTML element.
 *
 * @param options - Progress bar configuration
 * @returns HTML string for the progress bar
 *
 * @example
 * ```typescript
 * createProgressBar({ percent: 45 })
 * // Basic progress bar at 45%
 *
 * createProgressBar({ percent: 100, state: 'success', showText: true })
 * // Success state with "100%" text
 * ```
 */
export function createProgressBar(options: ProgressBarOptions = {}): string {
  const {
    percent = 0,
    state = "default",
    showText = false,
    size = "md",
    className = "",
    id,
  } = options;

  const progressClasses = [
    "progress",
    `progress--${size}`,
    state !== "default" ? `progress--${state}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const idAttr = id ? `id="${id}"` : "";
  const clampedPercent = Math.min(100, Math.max(0, percent));

  const progressHtml = `
    <div class="${progressClasses}" ${idAttr} role="progressbar" aria-valuenow="${clampedPercent}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress__bar" style="width: ${clampedPercent}%"></div>
    </div>
  `;

  if (!showText) {
    return progressHtml;
  }

  return `
    <div class="progress-labeled">
      ${progressHtml}
      <span class="progress-labeled__text">${clampedPercent}%</span>
    </div>
  `;
}

/**
 * Creates a queue item HTML element (file name + progress bar + status).
 *
 * @param options - Queue item configuration
 * @returns HTML string for the queue item
 *
 * @example
 * ```typescript
 * createQueueItem({
 *   fileId: 'file-123',
 *   fileName: 'photo.jpg',
 *   percent: 45,
 *   status: 'uploading'
 * })
 * ```
 */
export function createQueueItem(options: QueueItemOptions): string {
  const {
    fileId,
    fileName,
    percent = 0,
    status = "pending",
    errorMessage,
  } = options;

  const stateClass = status === "complete"
    ? "queue-item--complete"
    : status === "error"
      ? "queue-item--error"
      : "";

  // Truncate long file names
  const displayName = fileName.length > 30
    ? `${fileName.substring(0, 15)}...${fileName.slice(-12)}`
    : fileName;

  // Determine status text
  let statusText = "Pending...";
  if (status === "uploading") {
    statusText = `${percent}%`;
  } else if (status === "complete") {
    statusText = "Complete";
  } else if (status === "error") {
    statusText = errorMessage || "Error";
  }

  return `
    <div class="queue-item ${stateClass}" data-file-id="${escapeHtml(fileId)}">
      <span class="queue-item__name" title="${escapeHtml(fileName)}">${escapeHtml(displayName)}</span>
      <div class="queue-item__progress">
        <div class="progress">
          <div class="progress__bar" style="width: ${percent}%"></div>
        </div>
      </div>
      <span class="queue-item__status">${escapeHtml(statusText)}</span>
    </div>
  `;
}

/**
 * Creates an upload queue container.
 *
 * @param items - Array of queue item HTML strings
 * @param title - Optional section title
 * @returns HTML string for the upload queue
 */
export function createUploadQueue(items: string[] = [], title?: string): string {
  const titleHtml = title
    ? `<div class="upload-queue__title">${escapeHtml(title)}</div>`
    : "";

  return `
    <div class="upload-queue" id="upload-queue">
      ${titleHtml}
      ${items.join("")}
    </div>
  `;
}

