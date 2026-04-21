/**
 * Clipboard utility scripts for Cloudinary VS Code extension webviews.
 * Handles copy-to-clipboard functionality with fallback for VS Code sandbox.
 */

/**
 * Returns JavaScript for clipboard functionality.
 * Initializes all copy buttons and handles clipboard operations with fallback.
 */
export function getClipboardScript(): string {
  return `
    /**
     * Initialize all copy buttons on the page.
     * Looks for buttons with class 'btn--copy' and 'data-copy' attribute.
     */
    function initCopyButtons() {
      const copyButtons = document.querySelectorAll('.btn--copy[data-copy]');
      
      copyButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const textToCopy = btn.getAttribute('data-copy');
          if (!textToCopy) return;
          
          await copyToClipboard(textToCopy, btn);
        });
      });
    }

    /**
     * Copy text to clipboard with visual feedback.
     * Falls back to VS Code API if navigator.clipboard fails.
     * 
     * @param {string} text - Text to copy
     * @param {HTMLElement} button - Button element for feedback (optional)
     */
    async function copyToClipboard(text, button) {
      try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback(button, true);
      } catch (err) {
        // Fallback to VS Code API for sandboxed webviews
        if (typeof vscode !== 'undefined') {
          vscode.postMessage({
            command: 'copyToClipboard',
            text: text
          });
          showCopyFeedback(button, true);
        } else {
          showCopyFeedback(button, false);
          console.error('Failed to copy to clipboard:', err);
        }
      }
    }

    /**
     * Show visual feedback on copy button.
     * 
     * @param {HTMLElement} button - Button element
     * @param {boolean} success - Whether copy was successful
     */
    function showCopyFeedback(button, success) {
      if (!button) return;
      
      const originalText = button.textContent;
      const originalClass = button.className;
      
      if (success) {
        button.textContent = 'Copied!';
        button.classList.add('copied');
      } else {
        button.textContent = 'Failed';
        button.classList.add('error');
      }
      
      setTimeout(() => {
        button.textContent = originalText;
        button.className = originalClass;
      }, 1500);
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCopyButtons);
    } else {
      initCopyButtons();
    }
  `;
}

/**
 * Returns a minimal clipboard handler for inline use.
 * Use this when you only need basic copy functionality without button initialization.
 */
export function getInlineClipboardHandler(): string {
  return `
    async function copyText(text, button) {
      try {
        await navigator.clipboard.writeText(text);
        if (button) {
          const orig = button.textContent;
          button.textContent = 'Copied!';
          button.classList.add('copied');
          setTimeout(() => {
            button.textContent = orig;
            button.classList.remove('copied');
          }, 1500);
        }
      } catch {
        if (typeof vscode !== 'undefined') {
          vscode.postMessage({ command: 'copyToClipboard', text: text });
        }
      }
    }
  `;
}
