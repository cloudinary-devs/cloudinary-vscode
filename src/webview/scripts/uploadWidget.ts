/**
 * Client-side JavaScript for the Upload Widget webview.
 * This module generates the script content to be embedded in the webview.
 */

/**
 * Returns the upload widget client-side JavaScript.
 * @param cloudName - The Cloudinary cloud name
 * @param presetsJson - JSON string of upload presets
 */
export function getUploadWidgetScript(cloudName: string, presetsJson: string): string {
  return `
    const cloudName = "${cloudName}";
    const presets = ${presetsJson};

    // Element references
    const dropZone = document.getElementById('dropZone');
    const browseBtn = document.getElementById('browseBtn');
    const fileInput = document.getElementById('fileInput');
    const urlInput = document.getElementById('urlInput');
    const uploadUrlBtn = document.getElementById('uploadUrlBtn');
    const uploadQueue = document.getElementById('upload-queue');
    const uploadedAssets = document.getElementById('uploaded-assets');
    const assetGrid = document.getElementById('asset-grid');
    const presetSelect = document.getElementById('presetSelect');
    const folderSelect = document.getElementById('folderSelect');
    const clearBtn = document.getElementById('clearBtn');
    const publicIdInput = document.getElementById('publicIdInput');
    const tagsInput = document.getElementById('tagsInput');
    const presetDetailsToggle = document.getElementById('presetDetailsToggle');
    const presetDetails = document.getElementById('presetDetails');
    const advancedHeader = document.getElementById('advancedHeader');
    const advancedContent = document.getElementById('advancedContent');

    // Queue state
    const queue = new Map();

    // ========================================
    // Preset Management
    // ========================================

    function formatPresetSettings(settings) {
      if (!settings || Object.keys(settings).length === 0) {
        return 'No specific settings configured';
      }

      return Object.entries(settings)
        .map(([key, value]) => {
          const formattedKey = key.replace(/_/g, ' ').replace(/\\b\\w/g, l => l.toUpperCase());
          let formattedValue = value;
          if (value === '0' || value === 0) formattedValue = 'No';
          else if (value === '1' || value === 1) formattedValue = 'Yes';
          else if (value === 'true') formattedValue = 'Yes';
          else if (value === 'false') formattedValue = 'No';
          else if (Array.isArray(value)) formattedValue = value.join(', ');
          else if (typeof value === 'object') formattedValue = JSON.stringify(value);
          return \`\${formattedKey}: \${formattedValue}\`;
        })
        .join('\\n');
    }

    function updatePresetDetails() {
      const selectedValue = presetSelect.value;
      if (!selectedValue) {
        presetDetails.textContent = 'Using signed upload (no preset required)';
        return;
      }
      const preset = presets.find(p => p.name === selectedValue);
      if (preset) {
        presetDetails.textContent = formatPresetSettings(preset.settings);
      }
    }

    // Initialize preset details
    updatePresetDetails();

    // Toggle preset details visibility
    if (presetDetailsToggle) {
      presetDetailsToggle.addEventListener('click', () => {
        const isVisible = presetDetails.classList.toggle('visible');
        presetDetailsToggle.classList.toggle('expanded', isVisible);
        presetDetailsToggle.textContent = isVisible ? 'Hide' : 'Settings';
      });
    }

    presetSelect.addEventListener('change', updatePresetDetails);

    // Toggle advanced options
    advancedHeader.addEventListener('click', () => {
      advancedHeader.classList.toggle('expanded');
      advancedContent.classList.toggle('visible');
    });

    // ========================================
    // Form Helpers
    // ========================================

    function getCurrentPreset() {
      return presetSelect.value || null;
    }

    function getCurrentFolder() {
      return folderSelect.value;
    }

    function getPublicId() {
      return publicIdInput.value.trim();
    }

    function getTags() {
      return tagsInput.value.trim();
    }

    // Notify extension when folder changes
    folderSelect.addEventListener('change', () => {
      vscode.postMessage({
        command: 'folderChanged',
        folderPath: getCurrentFolder()
      });
    });

    // ========================================
    // File Selection
    // ========================================

    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      processFiles(files);
      fileInput.value = '';
    });

    // ========================================
    // Drag and Drop
    // ========================================

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processFiles(files);
      }
    });

    // ========================================
    // File Processing
    // ========================================

    function processFiles(files) {
      const customPublicId = getPublicId();
      const tags = getTags();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = generateId('file');

        addToQueue(fileId, file.name);

        const reader = new FileReader();
        reader.onload = () => {
          vscode.postMessage({
            command: 'uploadFile',
            fileId: fileId,
            fileName: file.name,
            dataUri: reader.result,
            preset: getCurrentPreset(),
            folderPath: getCurrentFolder(),
            publicId: (files.length === 1) ? customPublicId : '',
            tags: tags
          });
        };
        reader.onerror = () => {
          updateQueueItem(fileId, 'error', 0, 'Failed to read file');
        };
        reader.readAsDataURL(file);
      }

      if (files.length === 1 && customPublicId) {
        publicIdInput.value = '';
      }
    }

    // ========================================
    // URL Upload
    // ========================================

    uploadUrlBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (!url) return;

      const fileId = generateId('url');
      addToQueue(fileId, url);

      vscode.postMessage({
        command: 'uploadUrl',
        fileId: fileId,
        url: url,
        preset: getCurrentPreset(),
        folderPath: getCurrentFolder(),
        publicId: getPublicId(),
        tags: getTags()
      });

      urlInput.value = '';
      publicIdInput.value = '';
    });

    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        uploadUrlBtn.click();
      }
    });

    // ========================================
    // Queue Management
    // ========================================

    clearBtn.addEventListener('click', () => {
      assetGrid.innerHTML = '';
      uploadQueue.innerHTML = '';
      uploadedAssets.classList.add('hidden');
      queue.clear();
    });

    function addToQueue(fileId, fileName) {
      const item = document.createElement('div');
      item.className = 'queue-item';
      item.setAttribute('data-file-id', fileId);

      const displayName = truncateString(fileName, 30, 'middle');

      item.innerHTML = \`
        <span class="queue-item__name" title="\${fileName}">\${displayName}</span>
        <div class="queue-item__progress">
          <div class="progress">
            <div class="progress__bar" style="width: 0%"></div>
          </div>
        </div>
        <span class="queue-item__status">Pending...</span>
      \`;

      uploadQueue.appendChild(item);
      queue.set(fileId, { fileName, status: 'pending', progress: 0 });
    }

    function updateQueueItem(fileId, status, progress, errorMsg) {
      const item = uploadQueue.querySelector(\`[data-file-id="\${fileId}"]\`);
      if (!item) return;

      const progressBar = item.querySelector('.progress__bar');
      const statusEl = item.querySelector('.queue-item__status');

      item.className = 'queue-item';
      if (status === 'complete') item.classList.add('queue-item--complete');
      if (status === 'error') item.classList.add('queue-item--error');

      progressBar.style.width = progress + '%';

      if (status === 'uploading') {
        statusEl.textContent = progress + '%';
      } else if (status === 'complete') {
        statusEl.textContent = 'Complete';
      } else if (status === 'error') {
        statusEl.textContent = errorMsg || 'Error';
      }

      queue.set(fileId, { ...queue.get(fileId), status, progress });
    }

    // ========================================
    // Thumbnail Generation
    // ========================================

    function getThumbnailUrl(asset) {
      const publicId = asset.public_id;
      const resourceType = asset.resource_type;

      if (resourceType === 'image') {
        return \`https://res.cloudinary.com/\${cloudName}/image/upload/w_130,h_100,c_fill,g_auto,f_auto,q_auto/\${publicId}\`;
      } else if (resourceType === 'video') {
        return \`https://res.cloudinary.com/\${cloudName}/video/upload/w_130,h_100,c_fill,so_auto,f_jpg/\${publicId}.jpg\`;
      }
      return null;
    }

    function getFileIcon() {
      return "<svg width='48' height='48' viewBox='0 0 24 24' fill='currentColor'><path d='M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM9 13H15V15H9V13ZM9 17H15V19H9V17Z'/></svg>";
    }

    // ========================================
    // Asset Rendering
    // ========================================

    function openAssetPreview(asset) {
      vscode.postMessage({
        command: 'openAsset',
        asset: asset
      });
    }

    function renderUploadedAsset(asset) {
      uploadedAssets.classList.remove('hidden');

      const thumbnailUrl = getThumbnailUrl(asset);
      const folderDisplay = asset._uploadedToFolder || '(root)';

      const card = document.createElement('div');
      card.className = 'asset-card';

      let mediaHtml;
      if (thumbnailUrl) {
        mediaHtml = \`
          <div class="asset-card__thumbnail" data-asset-id="\${asset.public_id}">
            <img class="asset-card__image" src="\${thumbnailUrl}" alt="Thumbnail" />
            <div class="asset-card__icon fallback" style="display:none;">\${getFileIcon()}</div>
          </div>
        \`;
      } else {
        mediaHtml = \`
          <div class="asset-card__thumbnail" data-asset-id="\${asset.public_id}">
            <div class="asset-card__icon">\${getFileIcon()}</div>
          </div>
        \`;
      }

      const displayId = truncateString(asset.public_id, 25, 'start');

      card.innerHTML = \`
        \${mediaHtml}
        <div class="asset-card__folder">📂 <code>\${folderDisplay}</code></div>
        <div class="asset-card__id" title="\${asset.public_id}">\${displayId}</div>
        <div class="asset-card__actions">
          <button class="btn btn--secondary btn--sm btn--copy" data-copy="\${asset.secure_url}">Copy URL</button>
          <button class="btn btn--secondary btn--sm btn--copy" data-copy="\${asset.public_id}">Copy ID</button>
        </div>
      \`;

      card._assetData = asset;

      const thumbnailWrapper = card.querySelector('.asset-card__thumbnail');
      thumbnailWrapper.addEventListener('click', () => {
        openAssetPreview(asset);
      });

      const img = card.querySelector('.asset-card__image');
      if (img) {
        img.addEventListener('error', function() {
          this.style.display = 'none';
          const fallback = this.parentElement.querySelector('.fallback');
          if (fallback) {
            fallback.style.display = 'flex';
          }
        });
      }

      // Re-initialize copy buttons for new card
      card.querySelectorAll('.btn--copy[data-copy]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const textToCopy = btn.getAttribute('data-copy');
          await copyToClipboard(textToCopy, btn);
        });
      });

      assetGrid.insertBefore(card, assetGrid.firstChild);
    }

    // ========================================
    // Message Handling
    // ========================================

    window.addEventListener('message', (event) => {
      const message = event.data;

      switch (message.command) {
        case 'uploadStarted':
          updateQueueItem(message.fileId, 'uploading', 0);
          break;

        case 'uploadProgress':
          updateQueueItem(message.fileId, 'uploading', message.percent);
          break;

        case 'uploadComplete':
          updateQueueItem(message.fileId, 'complete', 100);
          if (message.asset) {
            renderUploadedAsset(message.asset);
          }
          break;

        case 'uploadError':
          updateQueueItem(message.fileId, 'error', 0, message.error);
          break;

        case 'setFolder':
          if (message.folderPath !== undefined) {
            folderSelect.value = message.folderPath;
          }
          break;

        case 'updateFolders':
          if (message.folders) {
            const currentValue = folderSelect.value;
            folderSelect.innerHTML = message.folders.map(f => 
              \`<option value="\${f.path}" \${f.path === currentValue ? 'selected' : ''}>\${f.label}</option>\`
            ).join('');
          }
          break;
      }
    });
  `;
}
