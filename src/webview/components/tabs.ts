/**
 * Tabs component for Cloudinary VS Code extension webviews.
 * Provides accessible tabbed navigation with content panels.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Individual tab configuration.
 */
export interface Tab {
  /** Unique identifier for the tab */
  id: string;
  /** Tab label text */
  label: string;
  /** Tab content (HTML string) */
  content: string;
  /** Whether this tab is initially active */
  active?: boolean;
  /** Optional badge text (e.g., count) */
  badge?: string;
}

/**
 * Tabs container configuration.
 */
export interface TabsOptions {
  /** Array of tab configurations */
  tabs: Tab[];
  /** Visual style variant */
  variant?: "default" | "underline" | "pills";
  /** Additional CSS classes for the container */
  className?: string;
  /** Container ID */
  id?: string;
}

/**
 * Returns CSS styles for tabs components.
 */
export function getTabStyles(): string {
  return `
    /* ========================================
       Tabs Container
       ======================================== */
    .tabs {
      width: 100%;
    }

    /* ========================================
       Tab Navigation
       ======================================== */
    .tabs__nav {
      display: flex;
      gap: 0;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: var(--space-lg);
      overflow-x: auto;
    }

    .tabs__nav--pills {
      gap: var(--space-sm);
      border-bottom: none;
      margin-bottom: var(--space-md);
    }

    /* ========================================
       Tab Buttons
       ======================================== */
    .tabs__btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-sm);
      padding: 0.65rem 1.25rem;
      background: none;
      border: none;
      font-family: inherit;
      font-size: var(--font-md);
      font-weight: 500;
      color: var(--color-text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: 
        color var(--transition-normal),
        border-color var(--transition-normal),
        background-color var(--transition-normal);
      white-space: nowrap;
    }

    .tabs__btn:hover {
      color: var(--color-text);
    }

    .tabs__btn:focus-visible {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: -2px;
    }

    .tabs__btn.active {
      color: var(--color-accent);
      border-bottom-color: var(--color-accent);
    }

    /* Pills variant */
    .tabs__nav--pills .tabs__btn {
      border-radius: var(--radius-sm);
      border-bottom: none;
      margin-bottom: 0;
      padding: 0.5rem 1rem;
    }

    .tabs__nav--pills .tabs__btn.active {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .tabs__nav--pills .tabs__btn:hover:not(.active) {
      background-color: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    }

    /* ========================================
       Tab Badge
       ======================================== */
    .tabs__badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.25rem;
      height: 1.25rem;
      padding: 0 0.35rem;
      font-size: var(--font-xs);
      font-weight: 600;
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: var(--radius-full);
    }

    /* ========================================
       Tab Content Panels
       ======================================== */
    .tabs__content {
      display: none;
      animation: tabFadeIn var(--transition-slow) ease-out;
    }

    .tabs__content.active {
      display: block;
    }

    @keyframes tabFadeIn {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
}

/**
 * Returns JavaScript for tab switching functionality.
 * This script should be included once per page.
 */
export function getTabScript(): string {
  return `
    function initTabs() {
      const tabContainers = document.querySelectorAll('.tabs');
      
      tabContainers.forEach(container => {
        // Get the nav element that is a direct child of this container
        const nav = container.querySelector(':scope > .tabs__nav');
        if (!nav) return;
        
        // Get only buttons that are direct children of this container's nav
        const buttons = nav.querySelectorAll(':scope > .tabs__btn');
        
        // Get only content panels that are direct children of this container
        const contents = container.querySelectorAll(':scope > .tabs__content');
        
        buttons.forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling to parent tabs
            const tabId = btn.dataset.tab;
            
            // Update button states (only for this tab container)
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content panels (only for this tab container)
            contents.forEach(c => c.classList.remove('active'));
            const targetContent = container.querySelector(':scope > #tab-' + tabId);
            if (targetContent) {
              targetContent.classList.add('active');
            }
          });
        });
      });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initTabs);
    } else {
      initTabs();
    }
  `;
}

/**
 * Creates a tabs component HTML element.
 *
 * @param options - Tabs configuration
 * @returns HTML string for the tabs component
 *
 * @example
 * ```typescript
 * createTabs({
 *   tabs: [
 *     { id: 'info', label: 'Info', content: '<p>Info content</p>', active: true },
 *     { id: 'meta', label: 'Metadata', content: '<p>Meta content</p>' },
 *     { id: 'urls', label: 'URLs', content: '<p>URL content</p>', badge: '2' },
 *   ]
 * })
 * ```
 */
export function createTabs(options: TabsOptions): string {
  const {
    tabs,
    variant = "default",
    className = "",
    id,
  } = options;

  // Ensure at least one tab is active
  const hasActiveTab = tabs.some((tab) => tab.active);
  if (!hasActiveTab && tabs.length > 0) {
    tabs[0].active = true;
  }

  const containerClasses = ["tabs", className].filter(Boolean).join(" ");
  const navClasses = [
    "tabs__nav",
    variant === "pills" ? "tabs__nav--pills" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const idAttr = id ? `id="${id}"` : "";

  // Build tab buttons
  const buttonsHtml = tabs
    .map((tab) => {
      const activeClass = tab.active ? "active" : "";
      const badgeHtml = tab.badge
        ? `<span class="tabs__badge">${escapeHtml(tab.badge)}</span>`
        : "";

      return `
        <button 
          class="tabs__btn ${activeClass}" 
          data-tab="${escapeHtml(tab.id)}"
          role="tab"
          aria-selected="${tab.active ? "true" : "false"}"
          aria-controls="tab-${escapeHtml(tab.id)}"
        >
          ${escapeHtml(tab.label)}${badgeHtml}
        </button>
      `;
    })
    .join("");

  // Build tab content panels
  const contentsHtml = tabs
    .map((tab) => {
      const activeClass = tab.active ? "active" : "";
      return `
        <div 
          class="tabs__content ${activeClass}" 
          id="tab-${escapeHtml(tab.id)}"
          role="tabpanel"
          aria-labelledby="tab-btn-${escapeHtml(tab.id)}"
        >
          ${tab.content}
        </div>
      `;
    })
    .join("");

  return `
    <div class="${containerClasses}" ${idAttr} role="tablist">
      <nav class="${navClasses}">
        ${buttonsHtml}
      </nav>
      ${contentsHtml}
    </div>
  `;
}

