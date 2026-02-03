/**
 * Common utilities for Cloudinary VS Code extension webviews.
 * This module provides shared functionality used across all webview panels.
 */

// VS Code API reference
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

interface VSCodeAPI {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

let vscode: VSCodeAPI | undefined;

/**
 * Initialize the VS Code API.
 */
export function initVSCode(): VSCodeAPI | undefined {
  if (typeof acquireVsCodeApi !== "undefined") {
    vscode = acquireVsCodeApi();
  }
  return vscode;
}

/**
 * Get the VS Code API instance.
 */
export function getVSCode(): VSCodeAPI | undefined {
  return vscode;
}

/**
 * Generate a unique ID.
 */
export function generateId(prefix = "id"): string {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
}

/**
 * Truncate string with ellipsis.
 */
export function truncateString(
  str: string,
  maxLength: number,
  position: "start" | "middle" | "end" = "end"
): string {
  if (str.length <= maxLength) {return str;}

  switch (position) {
    case "start":
      return "..." + str.slice(-(maxLength - 3));
    case "middle": {
      const half = Math.floor((maxLength - 3) / 2);
      return str.slice(0, half) + "..." + str.slice(-half);
    }
    case "end":
    default:
      return str.slice(0, maxLength - 3) + "...";
  }
}

/**
 * Format bytes to human readable size.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {return "0 B";}
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Copy text to clipboard with VS Code fallback.
 */
export async function copyToClipboard(
  text: string,
  button?: HTMLElement | null
): Promise<void> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (vscode) {
      vscode.postMessage({ command: "copyToClipboard", text: text });
    }

    // Visual feedback
    if (button) {
      const originalText = button.textContent;
      button.textContent = "Copied!";
      button.classList.add("btn--success");
      setTimeout(() => {
        button.textContent = originalText;
        button.classList.remove("btn--success");
      }, 1500);
    }
  } catch (err) {
    console.error("Failed to copy:", err);
    if (vscode) {
      vscode.postMessage({ command: "copyToClipboard", text: text });
    }
  }
}

/**
 * Initialize copy buttons.
 */
export function initCopyButtons(): void {
  document.querySelectorAll<HTMLElement>(".btn--copy[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textToCopy = btn.getAttribute("data-copy");
      if (textToCopy) {
        await copyToClipboard(textToCopy, btn);
      }
    });
  });
}

/**
 * Initialize tabs with support for nested tabs.
 */
export function initTabs(): void {
  const tabContainers = document.querySelectorAll<HTMLElement>(".tabs");

  tabContainers.forEach((container) => {
    const nav = container.querySelector<HTMLElement>(":scope > .tabs__nav");
    if (!nav) {return;}

    const buttons = nav.querySelectorAll<HTMLButtonElement>(":scope > .tabs__btn");
    const contents = container.querySelectorAll<HTMLElement>(":scope > .tabs__content");

    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const tabId = btn.dataset.tab;

        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        contents.forEach((c) => c.classList.remove("active"));
        const targetContent = container.querySelector<HTMLElement>(`:scope > #tab-${tabId}`);
        if (targetContent) {
          targetContent.classList.add("active");
        }
      });
    });
  });
}

/**
 * Initialize collapsible sections.
 */
export function initCollapsibles(): void {
  document.querySelectorAll<HTMLElement>(".collapsible__header").forEach((header) => {
    header.addEventListener("click", () => {
      header.classList.toggle("expanded");
      const content = header.nextElementSibling;
      if (content && content.classList.contains("collapsible__content")) {
        content.classList.toggle("visible");
      }
    });
  });
}

/**
 * Close lightbox.
 */
function closeLightbox(): void {
  const lightbox = document.getElementById("lightbox");
  if (lightbox) {
    lightbox.classList.remove("active");
    const video = lightbox.querySelector("video");
    if (video) {
      video.pause();
    }
  }
}

/**
 * Initialize lightbox functionality.
 */
export function initLightbox(): void {
  const lightbox = document.getElementById("lightbox");
  const enlargeBtn = document.getElementById("enlargeBtn");

  if (enlargeBtn && lightbox) {
    enlargeBtn.addEventListener("click", () => {
      lightbox.classList.add("active");
    });

    const closeBtn = lightbox.querySelector(".lightbox__close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeLightbox);
    }

    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lightbox.classList.contains("active")) {
        closeLightbox();
      }
    });
  }
}

/**
 * Initialize all common functionality.
 */
export function initCommon(): void {
  initVSCode();
  initTabs();
  initCopyButtons();
  initCollapsibles();
  initLightbox();
}

// Export to window for inline script access
declare global {
  interface Window {
    initCommon: typeof initCommon;
    copyToClipboard: typeof copyToClipboard;
    generateId: typeof generateId;
    truncateString: typeof truncateString;
    formatFileSize: typeof formatFileSize;
  }
}

window.initCommon = initCommon;
window.copyToClipboard = copyToClipboard;
window.generateId = generateId;
window.truncateString = truncateString;
window.formatFileSize = formatFileSize;
