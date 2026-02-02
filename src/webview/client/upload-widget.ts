/**
 * Upload Widget specific functionality.
 */

import {
  initCommon,
  getVSCode,
  generateId,
  truncateString,
  copyToClipboard,
} from "./common";

interface UploadPreset {
  name: string;
  settings?: Record<string, unknown>;
}

interface UploadConfig {
  cloudName: string;
  presets: UploadPreset[];
}

interface AssetData {
  public_id: string;
  secure_url: string;
  resource_type: string;
  _uploadedToFolder?: string;
}

interface UploadMessage {
  command: string;
  fileId?: string;
  percent?: number;
  asset?: AssetData;
  error?: string;
  folderPath?: string;
  folders?: Array<{ path: string; label: string }>;
}

// Configuration
let cloudName = "";
let presets: UploadPreset[] = [];

/**
 * Initialize upload widget with configuration.
 */
function initUploadWidget(config: UploadConfig): void {
  cloudName = config.cloudName || "";
  presets = config.presets || [];

  initPresetDetails();
  initFileUpload();
  initUrlUpload();
  initClearButton();
  initFolderChange();
}

/**
 * Initialize preset details toggle.
 */
function initPresetDetails(): void {
  const presetSelect = document.getElementById("presetSelect") as HTMLSelectElement | null;
  const presetDetailsToggle = document.getElementById("presetDetailsToggle");
  const presetDetails = document.getElementById("presetDetails");

  if (!presetSelect || !presetDetails) return;

  function formatPresetSettings(settings?: Record<string, unknown>): string {
    if (!settings || Object.keys(settings).length === 0) {
      return "No specific settings configured";
    }
    return Object.entries(settings)
      .map(([key, value]) => {
        const formattedKey = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        let formattedValue: string;
        if (value === "0" || value === 0) formattedValue = "No";
        else if (value === "1" || value === 1) formattedValue = "Yes";
        else if (value === "true") formattedValue = "Yes";
        else if (value === "false") formattedValue = "No";
        else if (Array.isArray(value)) formattedValue = value.join(", ");
        else if (typeof value === "object") formattedValue = JSON.stringify(value);
        else formattedValue = String(value);
        return `${formattedKey}: ${formattedValue}`;
      })
      .join("\n");
  }

  function updatePresetDetails(): void {
    const selectedValue = presetSelect!.value;
    if (!selectedValue) {
      presetDetails!.textContent = "Using signed upload (no preset required)";
      return;
    }
    const preset = presets.find((p) => p.name === selectedValue);
    if (preset) {
      presetDetails!.textContent = formatPresetSettings(preset.settings);
    }
  }

  updatePresetDetails();
  presetSelect.addEventListener("change", updatePresetDetails);

  if (presetDetailsToggle) {
    presetDetailsToggle.addEventListener("click", () => {
      const isVisible = presetDetails!.classList.toggle("visible");
      presetDetailsToggle.classList.toggle("expanded", isVisible);
      presetDetailsToggle.textContent = isVisible ? "Hide" : "Settings";
    });
  }
}

/**
 * Get current form values.
 */
function getFormValues(): { preset: string | null; folder: string; publicId: string; tags: string } {
  return {
    preset: (document.getElementById("presetSelect") as HTMLSelectElement | null)?.value || null,
    folder: (document.getElementById("folderSelect") as HTMLSelectElement | null)?.value || "",
    publicId: (document.getElementById("publicIdInput") as HTMLInputElement | null)?.value.trim() || "",
    tags: (document.getElementById("tagsInput") as HTMLInputElement | null)?.value.trim() || "",
  };
}

/**
 * Initialize file upload (drag & drop + browse).
 */
function initFileUpload(): void {
  const dropZone = document.getElementById("dropZone");
  const browseBtn = document.getElementById("browseBtn");
  const fileInput = document.getElementById("fileInput") as HTMLInputElement | null;

  if (!dropZone || !fileInput) return;

  if (browseBtn) {
    browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  fileInput.addEventListener("change", () => {
    const files = Array.from(fileInput.files || []);
    processFiles(files);
    fileInput.value = "";
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  });
}

/**
 * Process selected files for upload.
 */
function processFiles(files: File[]): void {
  const vscode = getVSCode();
  if (!vscode) return;

  const { preset, folder, publicId, tags } = getFormValues();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileId = generateId("file");

    addToQueue(fileId, file.name);

    const reader = new FileReader();
    reader.onload = () => {
      vscode.postMessage({
        command: "uploadFile",
        fileId: fileId,
        fileName: file.name,
        dataUri: reader.result,
        preset: preset,
        folderPath: folder,
        publicId: files.length === 1 ? publicId : "",
        tags: tags,
      });
    };
    reader.onerror = () => {
      updateQueueItem(fileId, "error", 0, "Failed to read file");
    };
    reader.readAsDataURL(file);
  }

  if (files.length === 1 && publicId) {
    const publicIdInput = document.getElementById("publicIdInput") as HTMLInputElement | null;
    if (publicIdInput) publicIdInput.value = "";
  }
}

/**
 * Initialize URL upload.
 */
function initUrlUpload(): void {
  const urlInput = document.getElementById("urlInput") as HTMLInputElement | null;
  const uploadUrlBtn = document.getElementById("uploadUrlBtn");

  if (!urlInput || !uploadUrlBtn) return;

  const vscode = getVSCode();

  uploadUrlBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url || !vscode) return;

    const { preset, folder, publicId, tags } = getFormValues();
    const fileId = generateId("url");

    addToQueue(fileId, url);

    vscode.postMessage({
      command: "uploadUrl",
      fileId: fileId,
      url: url,
      preset: preset,
      folderPath: folder,
      publicId: publicId,
      tags: tags,
    });

    urlInput.value = "";
    const publicIdInput = document.getElementById("publicIdInput") as HTMLInputElement | null;
    if (publicIdInput) publicIdInput.value = "";
  });

  urlInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      uploadUrlBtn.click();
    }
  });
}

/**
 * Initialize clear button.
 */
function initClearButton(): void {
  const clearBtn = document.getElementById("clearBtn");
  const assetGrid = document.getElementById("asset-grid");
  const uploadQueue = document.getElementById("upload-queue");
  const uploadedAssets = document.getElementById("uploaded-assets");

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (assetGrid) assetGrid.innerHTML = "";
      if (uploadQueue) uploadQueue.innerHTML = "";
      if (uploadedAssets) uploadedAssets.classList.add("hidden");
    });
  }
}

/**
 * Initialize folder change listener.
 */
function initFolderChange(): void {
  const folderSelect = document.getElementById("folderSelect") as HTMLSelectElement | null;
  const vscode = getVSCode();

  if (folderSelect && vscode) {
    folderSelect.addEventListener("change", () => {
      vscode.postMessage({
        command: "folderChanged",
        folderPath: folderSelect.value,
      });
    });
  }
}

/**
 * Add item to upload queue.
 */
function addToQueue(fileId: string, fileName: string): void {
  const uploadQueue = document.getElementById("upload-queue");
  if (!uploadQueue) return;

  const item = document.createElement("div");
  item.className = "queue-item";
  item.setAttribute("data-file-id", fileId);

  const displayName = truncateString(fileName, 30, "middle");

  item.innerHTML = `
    <span class="queue-item__name" title="${fileName}">${displayName}</span>
    <div class="queue-item__progress">
      <div class="progress">
        <div class="progress__bar" style="width: 0%"></div>
      </div>
    </div>
    <span class="queue-item__status">Pending...</span>
  `;

  uploadQueue.appendChild(item);
}

/**
 * Update queue item status.
 */
function updateQueueItem(
  fileId: string,
  status: "uploading" | "complete" | "error",
  progress: number,
  errorMsg?: string
): void {
  const uploadQueue = document.getElementById("upload-queue");
  if (!uploadQueue) return;

  const item = uploadQueue.querySelector(`[data-file-id="${fileId}"]`);
  if (!item) return;

  const progressBar = item.querySelector<HTMLElement>(".progress__bar");
  const statusEl = item.querySelector(".queue-item__status");

  item.className = "queue-item";
  if (status === "complete") item.classList.add("queue-item--complete");
  if (status === "error") item.classList.add("queue-item--error");

  if (progressBar) progressBar.style.width = progress + "%";

  if (statusEl) {
    if (status === "uploading") {
      statusEl.textContent = progress + "%";
    } else if (status === "complete") {
      statusEl.textContent = "Complete";
    } else if (status === "error") {
      statusEl.textContent = errorMsg || "Error";
    }
  }
}

/**
 * Get thumbnail URL for an asset.
 */
function getThumbnailUrl(asset: AssetData): string | null {
  const publicId = asset.public_id;
  const resourceType = asset.resource_type;

  if (resourceType === "image") {
    return `https://res.cloudinary.com/${cloudName}/image/upload/w_130,h_100,c_fill,g_auto,f_auto,q_auto/${publicId}`;
  } else if (resourceType === "video") {
    return `https://res.cloudinary.com/${cloudName}/video/upload/w_130,h_100,c_fill,so_auto,f_jpg/${publicId}.jpg`;
  }
  return null;
}

/**
 * Render uploaded asset card.
 */
function renderUploadedAsset(asset: AssetData): void {
  const vscode = getVSCode();
  const uploadedAssets = document.getElementById("uploaded-assets");
  const assetGrid = document.getElementById("asset-grid");

  if (!uploadedAssets || !assetGrid) return;

  uploadedAssets.classList.remove("hidden");

  const thumbnailUrl = getThumbnailUrl(asset);
  const folderDisplay = asset._uploadedToFolder || "(root)";

  const card = document.createElement("div");
  card.className = "asset-card";

  const fileIcon =
    "<svg width='48' height='48' viewBox='0 0 24 24' fill='currentColor'><path d='M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM9 13H15V15H9V13ZM9 17H15V19H9V17Z'/></svg>";

  let mediaHtml: string;
  if (thumbnailUrl) {
    mediaHtml = `
      <div class="asset-card__thumbnail" data-asset-id="${asset.public_id}">
        <img class="asset-card__image" src="${thumbnailUrl}" alt="Thumbnail" />
        <div class="asset-card__icon fallback" style="display:none;">${fileIcon}</div>
      </div>
    `;
  } else {
    mediaHtml = `
      <div class="asset-card__thumbnail" data-asset-id="${asset.public_id}">
        <div class="asset-card__icon">${fileIcon}</div>
      </div>
    `;
  }

  const displayId = truncateString(asset.public_id, 25, "start");

  card.innerHTML = `
    ${mediaHtml}
    <div class="asset-card__folder">📂 <code>${folderDisplay}</code></div>
    <div class="asset-card__id" title="${asset.public_id}">${displayId}</div>
    <div class="asset-card__actions">
      <button class="btn btn--secondary btn--sm btn--copy" data-copy="${asset.secure_url}">Copy URL</button>
      <button class="btn btn--secondary btn--sm btn--copy" data-copy="${asset.public_id}">Copy ID</button>
    </div>
  `;

  // Click thumbnail to preview
  const thumbnailWrapper = card.querySelector(".asset-card__thumbnail");
  if (thumbnailWrapper && vscode) {
    thumbnailWrapper.addEventListener("click", () => {
      vscode.postMessage({ command: "openAsset", asset: asset });
    });
  }

  // Handle image load errors
  const img = card.querySelector<HTMLImageElement>(".asset-card__image");
  if (img) {
    img.addEventListener("error", function () {
      this.style.display = "none";
      const fallback = this.parentElement?.querySelector<HTMLElement>(".fallback");
      if (fallback) fallback.style.display = "flex";
    });
  }

  // Initialize copy buttons
  card.querySelectorAll<HTMLElement>(".btn--copy[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const textToCopy = btn.getAttribute("data-copy");
      if (textToCopy) {
        await copyToClipboard(textToCopy, btn);
      }
    });
  });

  assetGrid.insertBefore(card, assetGrid.firstChild);
}

/**
 * Handle messages from the extension.
 */
function handleUploadMessage(message: UploadMessage): void {
  switch (message.command) {
    case "uploadStarted":
      if (message.fileId) updateQueueItem(message.fileId, "uploading", 0);
      break;

    case "uploadProgress":
      if (message.fileId) updateQueueItem(message.fileId, "uploading", message.percent || 0);
      break;

    case "uploadComplete":
      if (message.fileId) updateQueueItem(message.fileId, "complete", 100);
      if (message.asset) renderUploadedAsset(message.asset);
      break;

    case "uploadError":
      if (message.fileId) updateQueueItem(message.fileId, "error", 0, message.error);
      break;

    case "setFolder": {
      const folderSelect = document.getElementById("folderSelect") as HTMLSelectElement | null;
      if (folderSelect && message.folderPath !== undefined) {
        folderSelect.value = message.folderPath;
      }
      break;
    }

    case "updateFolders":
      if (message.folders) {
        const folderSelect = document.getElementById("folderSelect") as HTMLSelectElement | null;
        if (folderSelect) {
          const currentValue = folderSelect.value;
          folderSelect.innerHTML = message.folders
            .map(
              (f) =>
                `<option value="${f.path}" ${f.path === currentValue ? "selected" : ""}>${f.label}</option>`
            )
            .join("");
        }
      }
      break;
  }
}

// Listen for messages from the extension
window.addEventListener("message", (event) => {
  handleUploadMessage(event.data);
});

// Export to window for inline script access
declare global {
  interface Window {
    initUploadWidget: typeof initUploadWidget;
  }
}

window.initUploadWidget = initUploadWidget;

// Also run initCommon when this script loads
initCommon();
