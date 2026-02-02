/**
 * Lightbox/Modal component for Cloudinary VS Code extension webviews.
 * Provides full-screen image/video viewing capability.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Lightbox configuration options.
 */
export interface LightboxOptions {
  /** Content type */
  type: "image" | "video";
  /** Media source URL */
  src: string;
  /** Alt text for images */
  alt?: string;
  /** Lightbox ID */
  id?: string;
}

/**
 * Modal configuration options.
 */
export interface ModalOptions {
  /** Modal content (HTML string) */
  content: string;
  /** Modal title */
  title?: string;
  /** Modal ID */
  id?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg" | "full";
  /** Whether the modal is initially visible */
  visible?: boolean;
  /** Whether to show a close button */
  showClose?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Returns CSS styles for lightbox and modal components.
 */
export function getLightboxStyles(): string {
  return `
    /* ========================================
       Lightbox (Full-screen media viewer)
       ======================================== */
    .lightbox {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: var(--space-xxl);
    }

    .lightbox.active {
      display: flex;
    }

    .lightbox__content {
      max-width: 95%;
      max-height: 95%;
      object-fit: contain;
      border-radius: var(--radius-lg);
    }

    .lightbox__close {
      position: absolute;
      top: var(--space-lg);
      right: var(--space-lg);
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: var(--radius-full);
      width: 40px;
      height: 40px;
      cursor: pointer;
      color: white;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background-color var(--transition-normal);
    }

    .lightbox__close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* ========================================
       Modal (Dialog overlay)
       ======================================== */
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: var(--space-xl);
    }

    .modal.active {
      display: flex;
    }

    .modal__container {
      background-color: var(--color-surface-elevated);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg);
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: modalSlideIn var(--transition-slow) ease-out;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* Modal sizes */
    .modal__container--sm { width: 400px; }
    .modal__container--md { width: 600px; }
    .modal__container--lg { width: 800px; }
    .modal__container--full { width: 95%; max-width: 1200px; }

    .modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-lg);
      border-bottom: 1px solid var(--color-border);
    }

    .modal__title {
      margin: 0;
      font-size: var(--font-xl);
      font-weight: 600;
    }

    .modal__close {
      background: none;
      border: none;
      padding: var(--space-sm);
      cursor: pointer;
      color: var(--color-text-muted);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: 
        background-color var(--transition-fast),
        color var(--transition-fast);
    }

    .modal__close:hover {
      background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
      color: var(--color-text);
    }

    .modal__body {
      padding: var(--space-lg);
      overflow-y: auto;
      flex: 1;
    }

    .modal__footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-sm);
      padding: var(--space-md) var(--space-lg);
      border-top: 1px solid var(--color-border);
      background-color: var(--color-surface);
    }

    /* ========================================
       Preview Container (inline preview)
       ======================================== */
    .preview-container {
      position: relative;
      display: inline-block;
      width: 100%;
      margin-bottom: var(--space-lg);
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--color-border);
    }

    .preview-media {
      display: block;
      max-width: 100%;
      max-height: 250px;
      width: auto;
      margin: 0 auto;
      border-radius: var(--radius-md);
    }

    .preview-enlarge {
      position: absolute;
      top: var(--space-sm);
      right: var(--space-sm);
      background: rgba(0, 0, 0, 0.7);
      border: none;
      border-radius: var(--radius-md);
      padding: var(--space-sm);
      cursor: pointer;
      color: white;
      opacity: 0;
      transition: opacity var(--transition-normal), background-color var(--transition-normal);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-container:hover .preview-enlarge {
      opacity: 1;
    }

    .preview-enlarge:hover {
      background: rgba(0, 0, 0, 0.9);
    }

    /* ========================================
       Collapsible Section
       ======================================== */
    .collapsible {
      margin-bottom: var(--space-lg);
    }

    .collapsible__header {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      cursor: pointer;
      padding: var(--space-sm) 0;
      user-select: none;
    }

    .collapsible__header::before {
      content: '▶';
      font-size: var(--font-xs);
      transition: transform var(--transition-normal);
      color: var(--color-text-muted);
    }

    .collapsible__header.expanded::before {
      transform: rotate(90deg);
    }

    .collapsible__title {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--color-text-muted);
    }

    .collapsible__content {
      display: none;
      padding-top: var(--space-sm);
    }

    .collapsible__content.visible {
      display: block;
    }
  `;
}

/**
 * Returns JavaScript for lightbox functionality.
 */
export function getLightboxScript(): string {
  return `
    function initLightbox(lightboxId) {
      const lightbox = document.getElementById(lightboxId);
      if (!lightbox) return;

      const closeBtn = lightbox.querySelector('.lightbox__close');
      
      // Close on button click
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          closeLightbox(lightboxId);
        });
      }

      // Close on backdrop click
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
          closeLightbox(lightboxId);
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
          closeLightbox(lightboxId);
        }
      });
    }

    function openLightbox(lightboxId) {
      const lightbox = document.getElementById(lightboxId);
      if (lightbox) {
        lightbox.classList.add('active');
      }
    }

    function closeLightbox(lightboxId) {
      const lightbox = document.getElementById(lightboxId);
      if (lightbox) {
        lightbox.classList.remove('active');
        // Pause video if present
        const video = lightbox.querySelector('video');
        if (video) {
          video.pause();
        }
      }
    }

    function initModal(modalId) {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      const closeBtn = modal.querySelector('.modal__close');
      
      // Close on button click
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          closeModal(modalId);
        });
      }

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modalId);
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeModal(modalId);
        }
      });
    }

    function openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
      }
    }

    function closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('active');
      }
    }

    function initCollapsible() {
      document.querySelectorAll('.collapsible__header').forEach(header => {
        header.addEventListener('click', () => {
          header.classList.toggle('expanded');
          const content = header.nextElementSibling;
          if (content && content.classList.contains('collapsible__content')) {
            content.classList.toggle('visible');
          }
        });
      });
    }
  `;
}

/**
 * Enlarge icon SVG.
 */
export const enlargeIcon = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
  </svg>
`;

/**
 * Close icon SVG.
 */
export const closeIcon = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 6L6 18M6 6l12 12"/>
  </svg>
`;

/**
 * Creates a lightbox HTML element.
 *
 * @param options - Lightbox configuration
 * @returns HTML string for the lightbox
 *
 * @example
 * ```typescript
 * createLightbox({
 *   type: 'image',
 *   src: 'https://res.cloudinary.com/...',
 *   alt: 'Full size image'
 * })
 * ```
 */
export function createLightbox(options: LightboxOptions): string {
  const { type, src, alt = "", id = "lightbox" } = options;

  const contentHtml =
    type === "image"
      ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="lightbox__content" />`
      : `<video controls class="lightbox__content"><source src="${escapeHtml(src)}" type="video/mp4"></video>`;

  return `
    <div class="lightbox" id="${escapeHtml(id)}">
      <button class="lightbox__close" aria-label="Close">×</button>
      ${contentHtml}
    </div>
  `;
}

/**
 * Creates a modal HTML element.
 *
 * @param options - Modal configuration
 * @returns HTML string for the modal
 *
 * @example
 * ```typescript
 * createModal({
 *   title: 'Confirm Delete',
 *   content: '<p>Are you sure you want to delete this asset?</p>',
 *   size: 'sm'
 * })
 * ```
 */
export function createModal(options: ModalOptions): string {
  const {
    content,
    title,
    id = "modal",
    size = "md",
    visible = false,
    showClose = true,
    className = "",
  } = options;

  const modalClasses = ["modal", visible ? "active" : "", className]
    .filter(Boolean)
    .join(" ");

  const containerClasses = ["modal__container", `modal__container--${size}`]
    .join(" ");

  const headerHtml =
    title || showClose
      ? `
      <div class="modal__header">
        ${title ? `<h2 class="modal__title">${escapeHtml(title)}</h2>` : '<div></div>'}
        ${showClose ? `<button class="modal__close" aria-label="Close">${closeIcon}</button>` : ""}
      </div>
    `
      : "";

  return `
    <div class="${modalClasses}" id="${escapeHtml(id)}">
      <div class="${containerClasses}">
        ${headerHtml}
        <div class="modal__body">
          ${content}
        </div>
      </div>
    </div>
  `;
}

/**
 * Creates a preview container with enlarge button.
 *
 * @param options - Preview configuration
 * @returns HTML string for the preview container
 */
export function createPreviewContainer(options: {
  type: "image" | "video";
  src: string;
  optimizedSrc?: string;
  alt?: string;
  lightboxId?: string;
}): string {
  const {
    type,
    src,
    optimizedSrc,
    alt = "",
    lightboxId = "lightbox",
  } = options;

  const displaySrc = optimizedSrc || src;

  const mediaHtml =
    type === "image"
      ? `<img src="${escapeHtml(displaySrc)}" alt="${escapeHtml(alt)}" class="preview-media" id="previewMedia" />`
      : `<video controls class="preview-media" id="previewMedia"><source src="${escapeHtml(src)}" type="video/mp4"></video>`;

  return `
    <div class="preview-container" id="previewContainer">
      ${mediaHtml}
      <button class="preview-enlarge" id="enlargeBtn" title="View full size" onclick="openLightbox('${escapeHtml(lightboxId)}')">
        ${enlargeIcon}
      </button>
    </div>
  `;
}

/**
 * Creates a collapsible section.
 *
 * @param title - Section title
 * @param content - Section content (HTML string)
 * @param expanded - Whether initially expanded
 * @returns HTML string for the collapsible section
 */
export function createCollapsible(
  title: string,
  content: string,
  expanded = false
): string {
  const headerClass = expanded ? "collapsible__header expanded" : "collapsible__header";
  const contentClass = expanded ? "collapsible__content visible" : "collapsible__content";

  return `
    <div class="collapsible">
      <div class="${headerClass}">
        <span class="collapsible__title">${escapeHtml(title)}</span>
      </div>
      <div class="${contentClass}">
        ${content}
      </div>
    </div>
  `;
}

