/**
 * Client-side JavaScript for the Asset Preview webview.
 * This module generates the script content to be embedded in the webview.
 */

/**
 * Returns the asset preview client-side JavaScript.
 */
export function getPreviewAssetScript(): string {
  return `
    // ========================================
    // Lightbox Management
    // ========================================

    const enlargeBtn = document.getElementById('enlargeBtn');
    const lightbox = document.getElementById('lightbox');

    if (enlargeBtn && lightbox) {
      enlargeBtn.addEventListener('click', () => {
        lightbox.classList.add('active');
      });

      const closeBtn = lightbox.querySelector('.lightbox__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          closeLightbox();
        });
      }

      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
          closeLightbox();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
          closeLightbox();
        }
      });
    }

    function closeLightbox() {
      if (lightbox) {
        lightbox.classList.remove('active');
        const video = lightbox.querySelector('video');
        if (video) {
          video.pause();
        }
      }
    }
  `;
}
