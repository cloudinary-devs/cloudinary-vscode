import * as vscode from "vscode";
import { CloudinaryService } from "../cloudinary/cloudinaryService";
import { UploadPreset } from "../cloudinary/types";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import {
  createWebviewDocument,
  getScriptUri,
} from "../webview/webviewUtils";
import { escapeHtml } from "../webview/utils/helpers";

/**
 * Represents a folder option for the upload destination.
 */
interface FolderOption {
  path: string;
  label: string;
}

type UploadWidgetCloudinaryState = Pick<
  CloudinaryService,
  "cloudName" | "apiKey" | "apiSecret" | "uploadPresets" | "dynamicFolders"
> & {
  fetchUploadPresets(): Promise<UploadPreset[]>;
  getCurrentUploadPreset(): string | null;
  listAllFolders(maxDepth?: number): Promise<Array<{ path: string; name: string }>>;
};

type UploadWidgetCloudinaryStateTarget =
  | UploadWidgetCloudinaryState
  | {
      service?: UploadWidgetCloudinaryState;
    };

function hasUploadWidgetCloudinaryState(
  value: UploadWidgetCloudinaryStateTarget
): value is UploadWidgetCloudinaryState {
  return (
    "fetchUploadPresets" in value &&
    typeof value.fetchUploadPresets === "function"
  );
}

/**
 * Singleton panel instance for the upload widget.
 */
let uploadPanel: vscode.WebviewPanel | undefined;

/**
 * Current folder path for uploads.
 */
let currentFolderPath = "";

/**
 * Size threshold for chunked upload (20 MB).
 */
const CHUNKED_UPLOAD_THRESHOLD = 20 * 1024 * 1024;

/**
 * Chunk size for chunked uploads (6 MB).
 */
const UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024;

function getUploadAssetResourceType(asset: any): string {
  return asset.resource_type || "raw";
}

function getSignedOriginalUrl(asset: any, resourceType: string): string | undefined {
  if (asset.type !== "authenticated") {
    return undefined;
  }

  return cloudinary.url(asset.public_id, {
    resource_type: resourceType,
    type: asset.type,
    secure: true,
    sign_url: true,
    ...(resourceType !== "raw" && asset.format ? { format: asset.format } : {}),
  });
}

function getOptimizedUrl(asset: any, resourceType: string): string {
  const signedOriginalUrl = getSignedOriginalUrl(asset, resourceType);
  if (signedOriginalUrl) {
    return signedOriginalUrl;
  }

  return resourceType === "raw"
    ? cloudinary.url(asset.public_id, { resource_type: "raw", type: asset.type, secure: true })
    : cloudinary.url(asset.public_id, {
        resource_type: resourceType,
        type: asset.type,
        secure: true,
        transformation: [
          { fetch_format: resourceType === "video" ? "auto:video" : "auto" },
          { quality: "auto" },
        ],
      });
}

function withSignedAuthenticatedUrl(asset: any): any {
  const resourceType = getUploadAssetResourceType(asset);
  const signedOriginalUrl = getSignedOriginalUrl(asset, resourceType);
  return signedOriginalUrl
    ? { ...asset, secure_url: signedOriginalUrl }
    : asset;
}

/**
 * Registers commands for the Cloudinary upload widget.
 */
function registerUpload(
  context: vscode.ExtensionContext,
  cloudinaryStateTarget: UploadWidgetCloudinaryStateTarget
) {
  const cloudinaryState = getUploadCloudinaryState(cloudinaryStateTarget);

  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openUploadWidget", async () => {
      try {
        await openOrRevealUploadPanel("", cloudinaryState, context);
      } catch (err: any) {
        vscode.window.showErrorMessage(
          `Failed to open upload widget: ${err.message}`
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.uploadToFolder",
      async (folderItem: { label: string; data: { path?: string } }) => {
        try {
          const folderPath = folderItem.data.path || "";
          await openOrRevealUploadPanel(folderPath, cloudinaryState, context);
        } catch (err: any) {
          vscode.window.showErrorMessage(
            `Failed to open upload widget: ${err.message}`
          );
        }
      }
    )
  );
}

/**
 * Resets the upload panel for a new environment.
 * If the panel is currently open, disposes it and reopens it with the new
 * credentials already loaded in `provider`. No-ops if the panel is closed.
 */
export function resetUploadPanel(): void {
  if (!uploadPanel) {
    return;
  }
  uploadPanel.dispose();
  uploadPanel = undefined;
}

function getUploadCloudinaryState(
  cloudinaryStateTarget: UploadWidgetCloudinaryStateTarget
): UploadWidgetCloudinaryState {
  if (hasUploadWidgetCloudinaryState(cloudinaryStateTarget)) {
    return cloudinaryStateTarget;
  }

  const service = cloudinaryStateTarget.service;
  if (!service) {
    throw new Error("Cloudinary service is unavailable");
  }

  return service;
}

/**
 * Opens the upload panel or reveals it if already open.
 */
async function openOrRevealUploadPanel(
  folderPath: string,
  cloudinaryState: UploadWidgetCloudinaryState,
  context: vscode.ExtensionContext
): Promise<void> {
  currentFolderPath = folderPath;

  if (uploadPanel) {
    try {
      uploadPanel.reveal(vscode.ViewColumn.One);
      uploadPanel.webview.postMessage({
        command: "setFolder",
        folderPath: folderPath,
      });
      return;
    } catch {
      uploadPanel = undefined;
    }
  }

  uploadPanel = await createUploadPanel(cloudinaryState, context);

  uploadPanel.onDidDispose(() => {
    uploadPanel = undefined;
  });
}

/**
 * Posts a message to a webview panel, swallowing errors if the panel was disposed.
 */
function safePostToPanel(panel: vscode.WebviewPanel, message: unknown): void {
  try {
    panel.webview.postMessage(message);
  } catch {
    // Panel disposed between post calls; safe to ignore.
  }
}

/**
 * Uploads a file with progress tracking.
 */
async function uploadWithProgress(
  panel: vscode.WebviewPanel,
  dataUri: string,
  options: Record<string, any>,
  fileId: string
): Promise<any> {
  const base64Data = dataUri.split(",")[1];
  const buffer = Buffer.from(base64Data, "base64");
  const useChunkedUpload = buffer.length > CHUNKED_UPLOAD_THRESHOLD;

  return new Promise((resolve, reject) => {
    const uploadStream = useChunkedUpload
      ? cloudinary.uploader.upload_chunked_stream(
          { ...options, chunk_size: UPLOAD_CHUNK_SIZE },
          (error, result) => (error ? reject(error) : resolve(result))
        )
      : cloudinary.uploader.upload_stream(options, (error, result) =>
          error ? reject(error) : resolve(result)
        );

    let uploaded = 0;
    const total = buffer.length;
    const progressChunkSize = 64 * 1024;

    const readable = new Readable({
      read() {
        const chunk = buffer.slice(uploaded, uploaded + progressChunkSize);
        if (chunk.length > 0) {
          uploaded += chunk.length;
          const percent = Math.round((uploaded / total) * 100);
          safePostToPanel(panel, {
            command: "uploadProgress",
            fileId,
            percent,
          });
          this.push(chunk);
        } else {
          this.push(null);
        }
      },
    });

    readable.pipe(uploadStream);
  });
}

/**
 * Collects folder options from the Cloudinary service.
 */
async function collectFolderOptions(
  cloudinaryState: UploadWidgetCloudinaryState
): Promise<FolderOption[]> {
  const folders: FolderOption[] = [{ path: "", label: "/ (root)" }];
  const seenPaths = new Set<string>();

  try {
    for (const folder of await cloudinaryState.listAllFolders()) {
      if (!folder.path || seenPaths.has(folder.path)) {
        continue;
      }

      seenPaths.add(folder.path);
      folders.push({ path: folder.path, label: folder.path });
    }
  } catch {
    return folders;
  }

  return folders;
}

/**
 * Creates upload options for the Cloudinary API.
 */
function getUploadOptions(
  cloudinaryState: UploadWidgetCloudinaryState,
  presetName: string | null | undefined,
  folder: string,
  publicId?: string,
  tags?: string,
  fileName?: string
): Record<string, any> {
  const options: Record<string, any> = { resource_type: "auto" };

  if (presetName?.trim()) {
    options.upload_preset = presetName;
  }

  if (folder) {
    if (cloudinaryState.dynamicFolders) {
      options.asset_folder = folder;
    } else {
      options.folder = folder;
    }
  }

  if (fileName) {
    options.filename_override = fileName;
    if (cloudinaryState.dynamicFolders) {
      options.display_name = fileName.replace(/\.[^/.]+$/, "");
    }
  }

  if (publicId?.trim()) {
    options.public_id = publicId.trim();
  }

  if (tags?.trim()) {
    options.tags = tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t);
  }

  return options;
}

/**
 * Creates the webview panel with custom upload UI.
 */
async function createUploadPanel(
  cloudinaryState: UploadWidgetCloudinaryState,
  context: vscode.ExtensionContext
): Promise<vscode.WebviewPanel> {
  const cloudName = cloudinaryState.cloudName!;
  const panel = vscode.window.createWebviewPanel(
    "cloudinaryUploadWidget",
    `Upload — ${cloudName}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "media"),
      ],
    }
  );

  panel.iconPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    "cloudinary_icon_blue.png"
  );

  const currentPreset = cloudinaryState.getCurrentUploadPreset() || "";
  const initialFolders: FolderOption[] = [{ path: "", label: "/ (root)" }];

  const uploadScriptUri = getScriptUri(
    panel.webview,
    context.extensionUri,
    "upload-widget.js"
  );

  // Configuration to pass to the webview. Render with cached presets/folders
  // immediately; refresh asynchronously below to avoid blocking the panel open.
  const presetsJson = JSON.stringify(cloudinaryState.uploadPresets);
  const initScript = `
    initUploadWidget({
      cloudName: ${JSON.stringify(cloudName)},
      presets: ${presetsJson}
    });
  `;

  panel.webview.html = createWebviewDocument({
    title: "Upload to Cloudinary",
    webview: panel.webview,
    extensionUri: context.extensionUri,
    bodyContent: getUploadContent(
      currentPreset,
      cloudinaryState.uploadPresets,
      currentFolderPath,
      initialFolders
    ),
    bodyClass: "layout-centered",
    additionalScripts: [uploadScriptUri],
    inlineScript: initScript,
  });

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(async (message: any) => {
    if (message.command === "folderChanged" && message.folderPath !== undefined) {
      currentFolderPath = message.folderPath;
      return;
    }

    if (message.command === "uploadFile" && message.dataUri && message.fileId) {
      const presetName = message.preset !== undefined ? message.preset : currentPreset;
      const folder = message.folderPath !== undefined ? message.folderPath : currentFolderPath;
      const options = getUploadOptions(
        cloudinaryState,
        presetName,
        folder,
        message.publicId,
        message.tags,
        message.fileName
      );

      try {
        safePostToPanel(panel, { command: "uploadStarted", fileId: message.fileId });

        const result = withSignedAuthenticatedUrl(
          await uploadWithProgress(panel, message.dataUri, options, message.fileId)
        );
        result._uploadedToFolder = folder || "(root)";
        result._originalFileName = message.fileName;

        safePostToPanel(panel, {
          command: "uploadComplete",
          fileId: message.fileId,
          asset: result,
        });

        vscode.commands.executeCommand("cloudinary.refresh");
      } catch (err: any) {
        safePostToPanel(panel, {
          command: "uploadError",
          fileId: message.fileId,
          error: err.message || "Upload failed",
        });
        vscode.window.showErrorMessage(`Upload failed: ${err.message}`);
      }
    }

    if (message.command === "uploadUrl" && message.url) {
      const presetName = message.preset !== undefined ? message.preset : currentPreset;
      const folder = message.folderPath !== undefined ? message.folderPath : currentFolderPath;

      let urlFileName: string | undefined;
      try {
        const urlPath = new URL(message.url).pathname;
        const lastSegment = urlPath.split("/").pop();
        if (lastSegment?.includes(".")) {
          urlFileName = lastSegment;
        }
      } catch {
        // Invalid URL
      }

      const options = getUploadOptions(
        cloudinaryState,
        presetName,
        folder,
        message.publicId,
        message.tags,
        urlFileName
      );
      const fileId = message.fileId || `url-${Date.now()}`;

      try {
        safePostToPanel(panel, { command: "uploadStarted", fileId, fileName: message.url });
        safePostToPanel(panel, { command: "uploadProgress", fileId, percent: 50 });

        const result = withSignedAuthenticatedUrl(
          await cloudinary.uploader.upload(message.url, options)
        );
        result._uploadedToFolder = folder || "(root)";
        result._originalFileName = urlFileName;

        safePostToPanel(panel, { command: "uploadComplete", fileId, asset: result });
        vscode.commands.executeCommand("cloudinary.refresh");
      } catch (err: any) {
        safePostToPanel(panel, {
          command: "uploadError",
          fileId,
          error: err.message || "Upload failed",
        });
        vscode.window.showErrorMessage(`Upload failed: ${err.message}`);
      }
    }

    if (message.command === "copyToClipboard" && message.text) {
      await vscode.env.clipboard.writeText(message.text);
    }

    if (message.command === "refreshFolders") {
      const updatedFolders = await collectFolderOptions(cloudinaryState);
      safePostToPanel(panel, { command: "updateFolders", folders: updatedFolders });
    }

    if (message.command === "openAsset" && message.asset) {
      const asset = message.asset;
      const assetType = getUploadAssetResourceType(asset);
      const signedOriginalUrl = getSignedOriginalUrl(asset, assetType);
      const optimizedUrl = getOptimizedUrl(asset, assetType);

      const filename =
        asset._originalFileName ||
        (asset.original_filename !== "file" ? asset.original_filename : null) ||
        asset.public_id.split("/").pop() ||
        asset.public_id;

      vscode.commands.executeCommand("cloudinary.openAsset", {
        ...asset,
        displayType: assetType,
        secure_url: signedOriginalUrl || asset.secure_url,
        optimized_url: optimizedUrl,
        filename,
      });
    }
  });

  // Deferred load: fetch presets and folders in parallel without blocking the
  // initial render. Posts updates to the client when each completes.
  void (async () => {
    const presetsTask = cloudinaryState
      .fetchUploadPresets()
      .then((presets) => {
        safePostToPanel(panel, { command: "updatePresets", presets });
      })
      .catch((err) => {
        console.error("Failed to fetch upload presets:", err);
      });

    const foldersTask = collectFolderOptions(cloudinaryState)
      .then((folders) => {
        safePostToPanel(panel, { command: "updateFolders", folders });
      })
      .catch((err) => {
        console.error("Failed to load folders:", err);
      });

    await Promise.all([presetsTask, foldersTask]);
  })();

  return panel;
}

/**
 * Generates the body content for the upload webview.
 */
function getUploadContent(
  currentPreset: string,
  uploadPresets: UploadPreset[],
  initialFolderPath: string,
  folders: FolderOption[]
): string {
  const folderOptionsHtml = folders
    .map(
      (f) => `<option value="${escapeHtml(f.path)}" ${f.path === initialFolderPath ? "selected" : ""}>${escapeHtml(f.label)}</option>`
    )
    .join("");

  const presetOptionsHtml = uploadPresets
    .map(
      (p) => `<option value="${escapeHtml(p.name)}" ${p.name === currentPreset ? "selected" : ""}>${escapeHtml(p.name)} (${p.signed ? "Signed" : "Unsigned"})</option>`
    )
    .join("");

  return `
    <div class="panel panel--lg">
      <h2 class="panel__title">Upload to Cloudinary</h2>

      <div class="settings-row mb-lg">
        <div class="setting-card">
          <div class="form-group">
            <label class="form-group__label" for="folderSelect">Destination Folder</label>
            <select id="folderSelect" class="select">${folderOptionsHtml}</select>
          </div>
        </div>

        <div class="setting-card">
          <div class="form-group">
            <div class="preset-toggle">
              <label class="form-group__label" for="presetSelect">Upload Preset <span style="opacity: 0.7; font-weight: normal;">(optional)</span></label>
              ${uploadPresets.length > 0 ? '<button class="preset-toggle__btn" id="presetDetailsToggle">Settings</button>' : ""}
            </div>
            <select id="presetSelect" class="select">
              <option value="">No preset (signed upload)</option>
              ${presetOptionsHtml}
            </select>
            <div class="preset-details" id="presetDetails"></div>
          </div>
        </div>
      </div>

      <div class="collapsible mb-lg">
        <div class="collapsible__header" id="advancedHeader">
          <span class="collapsible__title">Advanced Options</span>
        </div>
        <div class="collapsible__content" id="advancedContent">
          <div class="settings-row">
            <div class="form-group">
              <label class="form-group__label" for="publicIdInput">Custom Public ID</label>
              <input type="text" id="publicIdInput" class="input" placeholder="Leave empty for auto-generated" />
              <div class="form-group__hint">Only applied to single file uploads</div>
            </div>
            <div class="form-group">
              <label class="form-group__label" for="tagsInput">Tags</label>
              <input type="text" id="tagsInput" class="input" placeholder="tag1, tag2, tag3" />
              <div class="form-group__hint">Comma-separated list of tags</div>
            </div>
          </div>
        </div>
      </div>

      <div class="tabs" role="tablist">
        <nav class="tabs__nav">
          <button class="tabs__btn active" data-tab="local" role="tab">Local Files</button>
          <button class="tabs__btn" data-tab="url" role="tab">Remote URL</button>
        </nav>

        <div class="tabs__content active" id="tab-local" role="tabpanel">
          <div class="drop-zone" id="dropZone">
            <div class="drop-zone__icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
              </svg>
            </div>
            <p class="drop-zone__text">Drag & drop files here</p>
            <p class="drop-zone__hint">— or —</p>
            <button class="btn btn--primary drop-zone__button" id="browseBtn">Browse Files</button>
            <input type="file" id="fileInput" class="drop-zone__input" multiple />
          </div>
        </div>

        <div class="tabs__content" id="tab-url" role="tabpanel">
          <div class="url-input-group">
            <input type="text" class="input" id="urlInput" placeholder="https://example.com/image.jpg" />
            <button class="btn btn--primary" id="uploadUrlBtn">Upload</button>
          </div>
        </div>
      </div>

      <div class="upload-queue" id="upload-queue"></div>

      <div id="uploaded-assets" class="uploaded-assets hidden">
        <div class="uploaded-assets__header">
          <h3 class="uploaded-assets__title">Uploaded Assets</h3>
          <button class="btn btn--secondary btn--sm" id="clearBtn">Clear All</button>
        </div>
        <div id="asset-grid" class="asset-grid"></div>
      </div>
    </div>
  `;
}

export default registerUpload;
