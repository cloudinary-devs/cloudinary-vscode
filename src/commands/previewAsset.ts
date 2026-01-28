import * as vscode from "vscode";

type AssetData = {
  public_id: string,
  displayType: "image" | "video" | string,
  secure_url: string,
  optimized_url: string,
  bytes: number,
  width: number,
  height: number,
  filename: string,
  format?: string,
  resource_type?: string
};

/**
 * Map of open preview panels by public_id.
 * Prevents opening multiple panels for the same asset.
 */
const openPanels: Map<string, vscode.WebviewPanel> = new Map();

function registerPreview(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openAsset", (asset: AssetData) => {
      const publicId = asset.public_id;

      // Check if panel for this asset already exists
      const existingPanel = openPanels.get(publicId);
      if (existingPanel) {
        // Reveal the existing panel
        existingPanel.reveal(vscode.ViewColumn.One);
        return;
      }

      // Get short display name for tab
      const shortName = asset.public_id.includes('/') 
        ? asset.public_id.split('/').pop() 
        : asset.public_id;

      // Create new panel
      const panel = vscode.window.createWebviewPanel(
        "cloudinaryAssetPreview",
        shortName || asset.public_id,
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      // Set the panel icon based on asset type
      const iconFile = asset.displayType === 'image' 
        ? 'icon-image.svg' 
        : asset.displayType === 'video' 
          ? 'icon-video.svg' 
          : 'icon-file.svg';
      panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "resources", iconFile);

      // Track this panel
      openPanels.set(publicId, panel);

      // Remove from tracking when disposed
      panel.onDidDispose(() => {
        openPanels.delete(publicId);
      });

      // Format file size
      const formatSize = (bytes: number) => {
        if (bytes === 0) { return '0 B'; }
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
      };

      // Get display name (last part of public_id)
      const displayName = asset.public_id.includes('/') 
        ? asset.public_id.split('/').pop() 
        : asset.public_id;

      // SVG icons
      const icons = {
        image: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.6751 17.125H17.3501C17.5334 17.125 17.6668 17.05 17.7501 16.9C17.8334 16.75 17.8168 16.6 17.7001 16.45L14.8001 12.55C14.7001 12.4333 14.5834 12.375 14.4501 12.375C14.3168 12.375 14.2001 12.4333 14.1001 12.55L11.1501 16.35L9.1751 13.65C9.0751 13.5333 8.95843 13.475 8.8251 13.475C8.69176 13.475 8.5751 13.5333 8.4751 13.65L6.3501 16.45C6.2501 16.6 6.23343 16.75 6.3001 16.9C6.36676 17.05 6.49176 17.125 6.6751 17.125ZM4.5501 21.15C4.1001 21.15 3.70426 20.9791 3.3626 20.6375C3.02093 20.2958 2.8501 19.9 2.8501 19.45V4.54998C2.8501 4.08331 3.02093 3.68331 3.3626 3.34998C3.70426 3.01664 4.1001 2.84998 4.5501 2.84998H19.4501C19.9168 2.84998 20.3168 3.01664 20.6501 3.34998C20.9834 3.68331 21.1501 4.08331 21.1501 4.54998V19.45C21.1501 19.9 20.9834 20.2958 20.6501 20.6375C20.3168 20.9791 19.9168 21.15 19.4501 21.15H4.5501ZM4.5501 19.45H19.4501V4.54998H4.5501V19.45Z"/>
        </svg>`,
        video: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.5501 3.84998L5.4001 7.64998H8.6501L6.8001 3.84998H9.0251L10.8751 7.64998H14.1251L12.2751 3.84998H14.5001L16.3501 7.64998H19.6001L17.7501 3.84998H20.4501C20.9168 3.84998 21.3168 4.01664 21.6501 4.34998C21.9834 4.68331 22.1501 5.08331 22.1501 5.54998V18.45C22.1501 18.9 21.9834 19.2958 21.6501 19.6375C21.3168 19.9791 20.9168 20.15 20.4501 20.15H3.5501C3.1001 20.15 2.70426 19.9833 2.3626 19.65C2.02093 19.3166 1.8501 18.9166 1.8501 18.45V5.54998C1.8501 5.08331 2.02093 4.68331 2.3626 4.34998C2.70426 4.01664 3.1001 3.84998 3.5501 3.84998ZM3.5501 9.34998V18.45H20.4501V9.34998H3.5501Z"/>
        </svg>`,
        file: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM9 13H15V15H9V13ZM9 17H15V19H9V17Z"/>
        </svg>`,
        download: `<svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
        </svg>`
      };

      // Determine asset type icon
      const typeIcon = asset.displayType === 'image' ? icons.image : asset.displayType === 'video' ? icons.video : icons.file;

      let previewHtml = "";
      let hasEnlarge = false;

      if (asset.displayType === "image") {
        hasEnlarge = true;
        previewHtml = `
          <div class="preview-container" id="previewContainer">
            <img src="${asset.optimized_url}" alt="${asset.public_id}" class="preview-media" id="previewMedia" />
            <button class="enlarge-btn" id="enlargeBtn" title="View full size">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
            </button>
          </div>
        `;
      } else if (asset.displayType === "video") {
        hasEnlarge = true;
        previewHtml = `
          <div class="preview-container" id="previewContainer">
            <video controls class="preview-media" id="previewMedia">
              <source src="${asset.secure_url}" type="video/mp4">
            </video>
            <button class="enlarge-btn" id="enlargeBtn" title="View full size">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
            </button>
          </div>
        `;
      } else {
        previewHtml = `
          <div class="raw-file-preview">
            <div class="raw-file-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM9 13H15V15H9V13ZM9 17H15V19H9V17Z"/>
              </svg>
            </div>
            <p class="raw-file-name">${displayName}</p>
            <a href="${asset.optimized_url}" target="_blank" class="download-link">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Download File
            </a>
          </div>
        `;
      }

      panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${asset.public_id}</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 1.5rem;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
          }
      
          .card {
            background-color: var(--vscode-editorWidget-background);
            padding: 1.25rem;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            max-width: 600px;
            width: 100%;
          }

          /* Header */
          .asset-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 1rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
          }

          .asset-type-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--vscode-textLink-foreground);
          }

          .asset-type-icon svg {
            width: 28px;
            height: 28px;
          }

          .asset-title {
            flex: 1;
            min-width: 0;
          }

          .asset-title h2 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .asset-title .asset-format {
            font-size: 0.75rem;
            color: var(--vscode-descriptionForeground);
            margin-top: 0.2rem;
          }

          .asset-format code {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 0.1rem 0.4rem;
            border-radius: 3px;
            font-size: 0.7rem;
            margin-right: 0.5rem;
          }

          /* Preview container */
          .preview-container {
            position: relative;
            display: inline-block;
            width: 100%;
            margin-bottom: 1rem;
            background: var(--vscode-editor-background);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--vscode-editorWidget-border);
          }

          .preview-media {
            display: block;
            max-width: 100%;
            max-height: 250px;
            width: auto;
            margin: 0 auto;
            border-radius: 6px;
          }

          .enlarge-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.7);
            border: none;
            border-radius: 6px;
            padding: 8px;
            cursor: pointer;
            color: white;
            opacity: 0;
            transition: opacity 0.2s, background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .preview-container:hover .enlarge-btn {
            opacity: 1;
          }

          .enlarge-btn:hover {
            background: rgba(0, 0, 0, 0.9);
          }

          /* Raw file preview */
          .raw-file-preview {
            text-align: center;
            padding: 2rem;
            background: var(--vscode-editor-background);
            border-radius: 8px;
            border: 1px solid var(--vscode-editorWidget-border);
            margin-bottom: 1rem;
          }

          .raw-file-icon {
            margin-bottom: 0.75rem;
            color: var(--vscode-descriptionForeground);
          }

          .raw-file-name {
            font-size: 0.9rem;
            color: var(--vscode-descriptionForeground);
            margin: 0.5rem 0;
            word-break: break-all;
          }

          .download-link {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            margin-top: 0.5rem;
            padding: 0.5rem 1rem;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.85rem;
            transition: background 0.15s;
          }

          .download-link:hover {
            background: var(--vscode-button-hoverBackground);
            text-decoration: none;
          }

          /* Lightbox modal */
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
            padding: 2rem;
          }

          .lightbox.active {
            display: flex;
          }

          .lightbox-content {
            max-width: 95%;
            max-height: 95%;
            object-fit: contain;
            border-radius: 8px;
          }

          .lightbox-close {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            cursor: pointer;
            color: white;
            font-size: 1.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          }

          .lightbox-close:hover {
            background: rgba(255, 255, 255, 0.2);
          }
      
          /* Tabs */
          nav {
            display: flex;
            gap: 0;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            margin-bottom: 1rem;
          }
      
          nav button {
            flex: 1;
            padding: 0.6rem 0.5rem;
            background: none;
            border: none;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            color: var(--vscode-descriptionForeground);
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
            transition: color 0.2s, border-color 0.2s;
          }

          nav button:hover {
            color: var(--vscode-editor-foreground);
          }
      
          nav button.active {
            color: var(--vscode-textLink-foreground);
            border-bottom-color: var(--vscode-textLink-foreground);
          }
      
          .tab-content {
            display: none;
          }
      
          .tab-content.active {
            display: block;
          }

          /* Info rows */
          .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem 0;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            font-size: 0.85rem;
          }

          .info-row:last-child {
            border-bottom: none;
          }

          .info-label {
            color: var(--vscode-descriptionForeground);
            font-weight: 500;
          }

          .info-value {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            text-align: right;
            word-break: break-all;
            max-width: 60%;
          }

          /* Metadata section */
          .meta-section {
            margin-bottom: 1rem;
          }

          .meta-section-title {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.5rem;
          }

          .meta-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.35rem;
          }

          .meta-tag {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
          }

          .meta-empty {
            color: var(--vscode-descriptionForeground);
            font-size: 0.8rem;
            font-style: italic;
          }

          /* URL section */
          .url-item {
            margin-bottom: 0.75rem;
            padding: 0.75rem;
            background: var(--vscode-editor-background);
            border-radius: 6px;
            border: 1px solid var(--vscode-editorWidget-border);
          }

          .url-item:last-child {
            margin-bottom: 0;
          }

          .url-label {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 0.35rem;
          }

          .url-value {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .url-value a {
            flex: 1;
            font-size: 0.8rem;
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            word-break: break-all;
          }

          .url-value a:hover {
            text-decoration: underline;
          }
      
          .copy-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.75rem;
            white-space: nowrap;
            transition: background-color 0.15s;
          }
      
          .copy-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }

          .copy-btn.copied {
            background-color: var(--vscode-testing-iconPassed, #4caf50);
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <!-- Header -->
          <div class="asset-header">
            <span class="asset-type-icon">${typeIcon}</span>
            <div class="asset-title">
              <h2 title="${asset.public_id}">${displayName}</h2>
              <div class="asset-format">
                <code>${(asset.format || asset.displayType || 'unknown').toUpperCase()}</code>
                ${asset.width && asset.height ? `${asset.width} × ${asset.height}` : ''}
                ${asset.bytes ? ` • ${formatSize(asset.bytes)}` : ''}
              </div>
            </div>
          </div>

          <!-- Preview -->
          ${previewHtml}
      
          <!-- Tabs -->
          <nav>
            <button class="tab-btn active" data-tab="info">Info</button>
            <button class="tab-btn" data-tab="meta">Metadata</button>
            <button class="tab-btn" data-tab="urls">URLs</button>
          </nav>
      
          <!-- Info Tab -->
          <div class="tab-content active" id="tab-info">
            <div class="info-row">
              <span class="info-label">Public ID</span>
              <span class="info-value">
                <span>${asset.public_id}</span>
                <button class="copy-btn" data-copy="${asset.public_id}">Copy</button>
              </span>
            </div>
            <div class="info-row">
              <span class="info-label">Original Filename</span>
              <span class="info-value">${asset.filename || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Dimensions</span>
              <span class="info-value">${asset.width && asset.height ? `${asset.width} × ${asset.height} px` : 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">File Size</span>
              <span class="info-value">${asset.bytes ? formatSize(asset.bytes) : 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Type</span>
              <span class="info-value">${asset.displayType || 'unknown'}</span>
            </div>
          </div>
      
          <!-- Metadata Tab -->
          <div class="tab-content" id="tab-meta">
            <div class="meta-section">
              <div class="meta-section-title">Tags</div>
              ${Array.isArray((asset as any).tags) && (asset as any).tags.length
                ? `<div class="meta-tags">${(asset as any).tags.map((t: string) => `<span class="meta-tag">${t}</span>`).join('')}</div>`
                : '<p class="meta-empty">No tags</p>'
              }
            </div>

            <div class="meta-section">
              <div class="meta-section-title">Context Metadata</div>
              ${(asset as any).context
                ? Object.entries((asset as any).context)
                    .map(([key, value]) => `<div class="info-row"><span class="info-label">${key}</span><span class="info-value">${value}</span></div>`)
                    .join("")
                : '<p class="meta-empty">No context metadata</p>'
              }
            </div>

            <div class="meta-section">
              <div class="meta-section-title">Structured Metadata</div>
              ${(asset as any).metadata
                ? Object.entries((asset as any).metadata)
                    .map(([key, value]) => `<div class="info-row"><span class="info-label">${key}</span><span class="info-value">${value}</span></div>`)
                    .join("")
                : '<p class="meta-empty">No structured metadata</p>'
              }
            </div>
          </div>
      
          <!-- URLs Tab -->
          <div class="tab-content" id="tab-urls">
            <div class="url-item">
              <div class="url-label">Original URL</div>
              <div class="url-value">
                <a href="${asset.secure_url}" target="_blank">${asset.secure_url}</a>
                <button class="copy-btn" data-copy="${asset.secure_url}">Copy</button>
              </div>
            </div>
            <div class="url-item">
              <div class="url-label">Optimized URL</div>
              <div class="url-value">
                <a href="${asset.optimized_url}" target="_blank">${asset.optimized_url}</a>
                <button class="copy-btn" data-copy="${asset.optimized_url}">Copy</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Lightbox for full-size view -->
        ${hasEnlarge ? `
        <div class="lightbox" id="lightbox">
          <button class="lightbox-close" id="lightboxClose">×</button>
          ${asset.displayType === 'image' 
            ? `<img src="${asset.secure_url}" alt="${asset.public_id}" class="lightbox-content" />`
            : `<video controls class="lightbox-content"><source src="${asset.secure_url}" type="video/mp4"></video>`
          }
        </div>
        ` : ''}
      
        <script>
          // Tab switching
          const tabs = document.querySelectorAll(".tab-btn");
          const contents = document.querySelectorAll(".tab-content");
      
          tabs.forEach((btn) => {
            btn.addEventListener("click", () => {
              tabs.forEach(t => t.classList.remove("active"));
              contents.forEach(c => c.classList.remove("active"));
      
              btn.classList.add("active");
              const target = document.getElementById("tab-" + btn.dataset.tab);
              if (target) target.classList.add("active");
            });
          });
      
          // Copy button functionality
          const copyButtons = document.querySelectorAll(".copy-btn");
          copyButtons.forEach((btn) => {
            btn.addEventListener("click", () => {
              const textToCopy = btn.getAttribute("data-copy");
              navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = btn.textContent;
                btn.textContent = "Copied!";
                btn.classList.add("copied");
                setTimeout(() => {
                  btn.textContent = originalText;
                  btn.classList.remove("copied");
                }, 1500);
              });
            });
          });

          // Lightbox functionality
          const enlargeBtn = document.getElementById('enlargeBtn');
          const lightbox = document.getElementById('lightbox');
          const lightboxClose = document.getElementById('lightboxClose');

          if (enlargeBtn && lightbox) {
            enlargeBtn.addEventListener('click', () => {
              lightbox.classList.add('active');
            });

            lightboxClose.addEventListener('click', () => {
              lightbox.classList.remove('active');
              // Pause video if playing
              const video = lightbox.querySelector('video');
              if (video) video.pause();
            });

            lightbox.addEventListener('click', (e) => {
              if (e.target === lightbox) {
                lightbox.classList.remove('active');
                const video = lightbox.querySelector('video');
                if (video) video.pause();
              }
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
              if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                lightbox.classList.remove('active');
                const video = lightbox.querySelector('video');
                if (video) video.pause();
              }
            });
          }
        </script>
      </body>
      </html>
      `;
    })
  );
}

export default registerPreview;
