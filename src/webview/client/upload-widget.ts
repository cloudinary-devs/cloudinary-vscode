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
  signed?: boolean;
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
  type?: string;
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
  presets?: UploadPreset[];
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

  if (!presetSelect || !presetDetails) {return;}

  function formatPresetSettings(settings?: Record<string, unknown>): string {
    if (!settings || Object.keys(settings).length === 0) {
      return "No specific settings configured";
    }
    return Object.entries(settings)
      .map(([key, value]) => {
        const formattedKey = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
        let formattedValue: string;
        if (value === "0" || value === 0) {formattedValue = "No";}
        else if (value === "1" || value === 1) {formattedValue = "Yes";}
        else if (value === "true") {formattedValue = "Yes";}
        else if (value === "false") {formattedValue = "No";}
        else if (Array.isArray(value)) {formattedValue = value.join(", ");}
        else if (typeof value === "object") {formattedValue = JSON.stringify(value);}
        else {formattedValue = String(value);}
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

  if (!dropZone || !fileInput) {return;}

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
  if (!vscode) {return;}

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
    if (publicIdInput) {publicIdInput.value = "";}
  }
}

/**
 * Initialize URL upload.
 */
function initUrlUpload(): void {
  const urlInput = document.getElementById("urlInput") as HTMLInputElement | null;
  const uploadUrlBtn = document.getElementById("uploadUrlBtn");

  if (!urlInput || !uploadUrlBtn) {return;}

  const vscode = getVSCode();

  uploadUrlBtn.addEventListener("click", () => {
    const url = urlInput.value.trim();
    if (!url || !vscode) {return;}

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
    if (publicIdInput) {publicIdInput.value = "";}
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
      if (assetGrid) {assetGrid.innerHTML = "";}
      if (uploadQueue) {uploadQueue.innerHTML = "";}
      if (uploadedAssets) {uploadedAssets.classList.add("hidden");}
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
  if (!uploadQueue) {return;}

  const item = document.createElement("div");
  item.className = "queue-item";
  item.setAttribute("data-file-id", fileId);

  const displayName = truncateString(fileName, 30, "middle");

  const nameEl = document.createElement("span");
  nameEl.className = "queue-item__name";
  nameEl.title = fileName;
  nameEl.textContent = displayName;

  const progressBar = document.createElement("div");
  progressBar.className = "progress__bar";
  progressBar.style.width = "0%";
  const progress = document.createElement("div");
  progress.className = "progress";
  progress.appendChild(progressBar);
  const progressWrapper = document.createElement("div");
  progressWrapper.className = "queue-item__progress";
  progressWrapper.appendChild(progress);

  const statusEl = document.createElement("span");
  statusEl.className = "queue-item__status";
  statusEl.textContent = "Pending...";

  item.appendChild(nameEl);
  item.appendChild(progressWrapper);
  item.appendChild(statusEl);

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
  if (!uploadQueue) {return;}

  const item = uploadQueue.querySelector(`[data-file-id="${fileId}"]`);
  if (!item) {return;}

  const progressBar = item.querySelector<HTMLElement>(".progress__bar");
  const statusEl = item.querySelector(".queue-item__status");

  item.className = "queue-item";
  if (status === "complete") {item.classList.add("queue-item--complete");}
  if (status === "error") {item.classList.add("queue-item--error");}

  if (progressBar) {progressBar.style.width = progress + "%";}

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

  if (asset.type === "authenticated") {
    return resourceType === "image" ? asset.secure_url : null;
  }

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

  if (!uploadedAssets || !assetGrid) {return;}

  uploadedAssets.classList.remove("hidden");

  const thumbnailUrl = getThumbnailUrl(asset);
  const folderDisplay = asset._uploadedToFolder || "(root)";

  const card = document.createElement("div");
  card.className = "asset-card";

  // Static SVG icon — no user data
  const fileIconSvg = "<svg width='48' height='48' viewBox='0 0 24 24' fill='currentColor'><path d='M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM9 13H15V15H9V13ZM9 17H15V19H9V17Z'/></svg>";

  // Thumbnail wrapper
  const thumbnailWrapper = document.createElement("div");
  thumbnailWrapper.className = "asset-card__thumbnail";
  thumbnailWrapper.setAttribute("data-asset-id", asset.public_id);

  if (thumbnailUrl) {
    const img = document.createElement("img");
    img.className = "asset-card__image";
    img.src = thumbnailUrl;
    img.alt = "Thumbnail";
    const fallbackEl = document.createElement("div");
    fallbackEl.className = "asset-card__icon fallback";
    fallbackEl.style.display = "none";
    fallbackEl.innerHTML = fileIconSvg;
    img.addEventListener("error", function () {
      this.style.display = "none";
      fallbackEl.style.display = "flex";
    });
    thumbnailWrapper.appendChild(img);
    thumbnailWrapper.appendChild(fallbackEl);
  } else {
    const iconEl = document.createElement("div");
    iconEl.className = "asset-card__icon";
    iconEl.innerHTML = fileIconSvg;
    thumbnailWrapper.appendChild(iconEl);
  }

  // Folder
  const folderEl = document.createElement("div");
  folderEl.className = "asset-card__folder";
  const folderCode = document.createElement("code");
  folderCode.textContent = folderDisplay;
  folderEl.appendChild(document.createTextNode("📂 "));
  folderEl.appendChild(folderCode);

  // Asset ID
  const displayId = truncateString(asset.public_id, 25, "start");
  const idEl = document.createElement("div");
  idEl.className = "asset-card__id";
  idEl.title = asset.public_id;
  idEl.textContent = displayId;

  // Action buttons
  const actionsEl = document.createElement("div");
  actionsEl.className = "asset-card__actions";

  const copyUrlBtn = document.createElement("button");
  copyUrlBtn.className = "btn btn--secondary btn--sm btn--copy";
  copyUrlBtn.setAttribute("data-copy", asset.secure_url);
  copyUrlBtn.textContent = "Copy URL";

  const copyIdBtn = document.createElement("button");
  copyIdBtn.className = "btn btn--secondary btn--sm btn--copy";
  copyIdBtn.setAttribute("data-copy", asset.public_id);
  copyIdBtn.textContent = "Copy ID";

  actionsEl.appendChild(copyUrlBtn);
  actionsEl.appendChild(copyIdBtn);

  card.appendChild(thumbnailWrapper);
  card.appendChild(folderEl);
  card.appendChild(idEl);
  card.appendChild(actionsEl);

  // Click thumbnail to preview
  if (vscode) {
    thumbnailWrapper.addEventListener("click", () => {
      vscode.postMessage({ command: "openAsset", asset: asset });
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
      if (message.fileId) {updateQueueItem(message.fileId, "uploading", 0);}
      break;

    case "uploadProgress":
      if (message.fileId) {updateQueueItem(message.fileId, "uploading", message.percent || 0);}
      break;

    case "uploadComplete":
      if (message.fileId) {updateQueueItem(message.fileId, "complete", 100);}
      if (message.asset) {renderUploadedAsset(message.asset);}
      break;

    case "uploadError":
      if (message.fileId) {updateQueueItem(message.fileId, "error", 0, message.error);}
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

    case "updatePresets":
      if (Array.isArray(message.presets)) {
        presets = message.presets;
        const presetSelect = document.getElementById("presetSelect") as HTMLSelectElement | null;
        if (presetSelect) {
          const currentValue = presetSelect.value;
          presetSelect.innerHTML = presets
            .map(
              (p) =>
                `<option value="${p.name}" ${p.name === currentValue ? "selected" : ""}>${p.name} (${p.signed ? "Signed" : "Unsigned"})</option>`
            )
            .join("");
          presetSelect.dispatchEvent(new Event("change"));
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
