/**
 * Drop zone component for Cloudinary VS Code extension webviews.
 * Provides drag-and-drop file upload functionality.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Drop zone configuration options.
 */
export interface DropZoneOptions {
  /** Primary instruction text */
  text?: string;
  /** Secondary hint text */
  hint?: string;
  /** Browse button text */
  buttonText?: string;
  /** File input ID */
  inputId?: string;
  /** Whether to accept multiple files */
  multiple?: boolean;
  /** Accepted file types (e.g., "image/*,video/*") */
  accept?: string;
  /** Additional CSS classes */
  className?: string;
  /** Drop zone ID */
  id?: string;
}

/**
 * Returns CSS styles for drop zone components.
 */
export function getDropZoneStyles(): string {
  return `
    /* ========================================
       Drop Zone Container
       ======================================== */
    .drop-zone {
      border: 2px dashed var(--color-border);
      border-radius: var(--radius-xl);
      padding: var(--space-xxl) var(--space-xl);
      text-align: center;
      background-color: var(--color-surface);
      transition: 
        border-color var(--transition-normal),
        background-color var(--transition-normal);
      cursor: pointer;
    }

    .drop-zone:hover,
    .drop-zone.drag-over {
      border-color: var(--vscode-focusBorder);
      background-color: rgba(0, 120, 212, 0.05);
    }

    .drop-zone.drag-over {
      border-style: solid;
    }

    /* ========================================
       Drop Zone Content
       ======================================== */
    .drop-zone__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--space-md);
      color: var(--color-accent);
      opacity: 0.8;
    }

    .drop-zone__icon svg {
      width: 48px;
      height: 48px;
    }

    .drop-zone__text {
      margin: var(--space-xs) 0;
      color: var(--color-text-muted);
      font-size: var(--font-md);
    }

    .drop-zone__hint {
      margin: var(--space-md) 0;
      font-size: var(--font-sm);
      color: var(--color-text-muted);
      opacity: 0.6;
    }

    .drop-zone__button {
      margin-top: var(--space-sm);
    }

    /* Hidden file input */
    .drop-zone__input {
      display: none;
    }

    /* ========================================
       Drop Zone Variants
       ======================================== */
    
    /* Compact variant */
    .drop-zone--compact {
      padding: var(--space-lg);
    }

    .drop-zone--compact .drop-zone__icon svg {
      width: 32px;
      height: 32px;
    }

    /* Minimal variant (no icon) */
    .drop-zone--minimal {
      padding: var(--space-lg);
    }

    .drop-zone--minimal .drop-zone__icon {
      display: none;
    }

    /* ========================================
       Asset Grid (for uploaded assets)
       ======================================== */
    .asset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: var(--space-lg);
    }

    /* ========================================
       Asset Card (thumbnail card)
       ======================================== */
    .asset-card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: 0.6rem;
      text-align: center;
      transition: 
        border-color var(--transition-normal),
        transform var(--transition-normal);
    }

    .asset-card:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateY(-2px);
    }

    .asset-card__thumbnail {
      position: relative;
      cursor: pointer;
    }

    .asset-card__thumbnail:hover::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .asset-card__image {
      width: 130px;
      height: 100px;
      object-fit: cover;
      border-radius: var(--radius-md);
      background: var(--color-surface-elevated);
    }

    .asset-card__icon {
      width: 130px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-elevated);
      border-radius: var(--radius-md);
      color: var(--color-text-muted);
    }

    .asset-card__folder {
      font-size: var(--font-xs);
      color: var(--color-text-muted);
      margin: var(--space-xs) 0;
      opacity: 0.8;
    }

    .asset-card__id {
      font-size: var(--font-xs);
      color: var(--color-text-muted);
      margin: var(--space-xs) 0;
      word-break: break-all;
      max-height: 2.4em;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .asset-card__actions {
      display: flex;
      gap: var(--space-xs);
      justify-content: center;
      flex-wrap: wrap;
    }

    /* ========================================
       Uploaded Assets Section
       ======================================== */
    .uploaded-assets {
      margin-top: var(--space-xl);
      padding-top: var(--space-xl);
      border-top: 1px solid var(--color-border);
    }

    .uploaded-assets.hidden {
      display: none;
    }

    .uploaded-assets__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--space-lg);
    }

    .uploaded-assets__title {
      margin: 0;
      font-size: var(--font-lg);
      font-weight: 600;
    }
  `;
}

/**
 * Returns JavaScript for drop zone functionality.
 */
export function getDropZoneScript(): string {
  return `
    function initDropZone(dropZoneId, fileInputId, onFilesSelected) {
      const dropZone = document.getElementById(dropZoneId);
      const fileInput = document.getElementById(fileInputId);
      
      if (!dropZone || !fileInput) return;

      // Prevent default drag behaviors
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
      });

      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // Highlight drop zone when dragging over
      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
          dropZone.classList.add('drag-over');
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
          dropZone.classList.remove('drag-over');
        }, false);
      });

      // Handle dropped files
      dropZone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0 && onFilesSelected) {
          onFilesSelected(files);
        }
      }, false);

      // Handle file input change
      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0 && onFilesSelected) {
          onFilesSelected(files);
        }
        fileInput.value = ''; // Reset for re-selection
      });

      // Click drop zone to trigger file input
      dropZone.addEventListener('click', (e) => {
        // Don't trigger if clicking the button (it has its own handler)
        if (!e.target.closest('.btn')) {
          fileInput.click();
        }
      });
    }
  `;
}

/**
 * Default upload icon SVG.
 */
export const uploadIcon = `
  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
  </svg>
`;

/**
 * File icon SVG for raw/unknown file types.
 */
export const fileIcon = `
  <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM9 13H15V15H9V13ZM9 17H15V19H9V17Z"/>
  </svg>
`;

/**
 * Creates a drop zone HTML element.
 *
 * @param options - Drop zone configuration
 * @returns HTML string for the drop zone
 *
 * @example
 * ```typescript
 * createDropZone({
 *   text: 'Drag & drop files here',
 *   hint: '— or —',
 *   buttonText: 'Browse Files',
 *   inputId: 'fileInput',
 *   multiple: true
 * })
 * ```
 */
export function createDropZone(options: DropZoneOptions = {}): string {
  const {
    text = "Drag & drop files here",
    hint = "— or —",
    buttonText = "Browse Files",
    inputId = "fileInput",
    multiple = true,
    accept,
    className = "",
    id = "dropZone",
  } = options;

  const dropZoneClasses = ["drop-zone", className].filter(Boolean).join(" ");

  const acceptAttr = accept ? `accept="${escapeHtml(accept)}"` : "";
  const multipleAttr = multiple ? "multiple" : "";

  return `
    <div class="${dropZoneClasses}" id="${escapeHtml(id)}">
      <div class="drop-zone__icon">
        ${uploadIcon}
      </div>
      <p class="drop-zone__text">${escapeHtml(text)}</p>
      <p class="drop-zone__hint">${escapeHtml(hint)}</p>
      <button class="btn btn--primary drop-zone__button" id="browseBtn" onclick="document.getElementById('${escapeHtml(inputId)}').click()">
        ${escapeHtml(buttonText)}
      </button>
      <input type="file" id="${escapeHtml(inputId)}" class="drop-zone__input" ${multipleAttr} ${acceptAttr} />
    </div>
  `;
}

/**
 * Creates an asset card HTML element for uploaded files.
 *
 * @param options - Asset card configuration
 * @returns HTML string for the asset card
 */
export function createAssetCard(options: {
  publicId: string;
  thumbnailUrl?: string;
  folder?: string;
  format?: string;
  secureUrl?: string;
}): string {
  const { publicId, thumbnailUrl, folder, format, secureUrl } = options;

  const displayId =
    publicId.length > 25 ? "..." + publicId.slice(-22) : publicId;

  const thumbnailHtml = thumbnailUrl
    ? `<img class="asset-card__image" src="${escapeHtml(thumbnailUrl)}" alt="Thumbnail" />`
    : `<div class="asset-card__icon">${fileIcon}<span style="margin-top: 4px; font-size: 0.7rem;">${format?.toUpperCase() || "FILE"}</span></div>`;

  const folderHtml = folder
    ? `<div class="asset-card__folder">📂 <code>${escapeHtml(folder)}</code></div>`
    : "";

  return `
    <div class="asset-card">
      <div class="asset-card__thumbnail">
        ${thumbnailHtml}
      </div>
      ${folderHtml}
      <div class="asset-card__id" title="${escapeHtml(publicId)}">${escapeHtml(displayId)}</div>
      <div class="asset-card__actions">
        ${secureUrl ? `<button class="btn btn--secondary btn--sm btn--copy" data-copy="${escapeHtml(secureUrl)}">Copy URL</button>` : ""}
        <button class="btn btn--secondary btn--sm btn--copy" data-copy="${escapeHtml(publicId)}">Copy ID</button>
      </div>
    </div>
  `;
}

/**
 * Creates an uploaded assets section.
 *
 * @param content - Grid content (asset cards)
 * @param title - Section title
 * @param clearButton - Whether to show a clear button
 * @returns HTML string for the uploaded assets section
 */
export function createUploadedAssetsSection(
  content: string,
  title = "Uploaded Assets",
  clearButton = true
): string {
  const clearButtonHtml = clearButton
    ? `<button class="btn btn--secondary btn--sm" id="clearBtn">Clear All</button>`
    : "";

  return `
    <div id="uploaded-assets" class="uploaded-assets hidden">
      <div class="uploaded-assets__header">
        <h3 class="uploaded-assets__title">✅ ${escapeHtml(title)}</h3>
        ${clearButtonHtml}
      </div>
      <div id="asset-grid" class="asset-grid">
        ${content}
      </div>
    </div>
  `;
}

