import * as vscode from "vscode";
import { CloudinaryTreeDataProvider } from "../tree/treeDataProvider";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

/**
 * Represents an upload preset from Cloudinary with its configuration.
 */
interface UploadPreset {
  name: string;
  signed: boolean;
  settings?: Record<string, any>;
}

/**
 * Represents a folder option for the upload destination.
 */
interface FolderOption {
  path: string;
  label: string;
}

/**
 * Singleton panel instance for the upload widget.
 * Only one upload panel exists at a time.
 */
let uploadPanel: vscode.WebviewPanel | undefined;

/**
 * Current folder path for uploads (managed by extension, updated via messages).
 */
let currentFolderPath = "";

/**
 * Registers commands for the Cloudinary upload widget.
 * - cloudinary.openUploadWidget: Opens the upload widget (root folder selected)
 * - cloudinary.uploadToFolder: Opens the upload widget with a specific folder pre-selected
 */
function registerUpload(
  context: vscode.ExtensionContext,
  provider: CloudinaryTreeDataProvider
) {
  // Register command to open upload widget (root)
  context.subscriptions.push(
    vscode.commands.registerCommand("cloudinary.openUploadWidget", async () => {
      try {
        // Fetch presets but don't require them - signed uploads work without presets
        await provider.fetchUploadPresets();
        openOrRevealUploadPanel("", provider, context);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to open upload widget: ${err.message}`);
      }
    })
  );

  // Register command to open upload widget in a specific folder
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.uploadToFolder",
      async (folderItem: { label: string; data: { path?: string } }) => {
        try {
          // Fetch presets but don't require them - signed uploads work without presets
          await provider.fetchUploadPresets();
          const folderPath = folderItem.data.path || "";
          openOrRevealUploadPanel(folderPath, provider, context);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to open upload widget: ${err.message}`);
        }
      }
    )
  );
}

/**
 * Opens the upload panel or reveals it if already open.
 * If a folder path is provided, updates the folder selection in the webview.
 */
function openOrRevealUploadPanel(
  folderPath: string,
  provider: CloudinaryTreeDataProvider,
  context: vscode.ExtensionContext
) {
  currentFolderPath = folderPath;

  if (uploadPanel) {
    // Panel exists - reveal it and update the folder selection
    uploadPanel.reveal(vscode.ViewColumn.One);
    uploadPanel.webview.postMessage({
      command: "setFolder",
      folderPath: folderPath,
    });
    return;
  }

  // Create new panel
  uploadPanel = createUploadPanel(provider, context);

  // Clear reference when panel is disposed
  uploadPanel.onDidDispose(() => {
    uploadPanel = undefined;
  });
}

/**
 * Size threshold (in bytes) above which to use chunked upload.
 * Files over 100 MB require chunked upload to avoid 413 errors.
 * We use a lower threshold (20 MB) for better reliability.
 */
const CHUNKED_UPLOAD_THRESHOLD = 20 * 1024 * 1024; // 20 MB

/**
 * Chunk size for chunked uploads. 6 MB is a good balance between
 * network resilience and upload speed.
 */
const UPLOAD_CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB

/**
 * Uploads a file to Cloudinary with progress tracking.
 * Uses chunked upload for large files to avoid 413 errors.
 */
async function uploadWithProgress(
  panel: vscode.WebviewPanel,
  dataUri: string,
  options: Record<string, any>,
  fileId: string
): Promise<any> {
  // Convert data URI to buffer
  const base64Data = dataUri.split(",")[1];
  const buffer = Buffer.from(base64Data, "base64");

  // Use chunked upload for large files to avoid 413 errors
  const useChunkedUpload = buffer.length > CHUNKED_UPLOAD_THRESHOLD;

  return new Promise((resolve, reject) => {
    let uploadStream;

    if (useChunkedUpload) {
      // Use chunked upload for large files
      uploadStream = cloudinary.uploader.upload_chunked_stream(
        { ...options, chunk_size: UPLOAD_CHUNK_SIZE },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    } else {
      // Use standard upload stream for smaller files
      uploadStream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    }

    // Create readable stream with progress tracking
    let uploaded = 0;
    const total = buffer.length;
    const progressChunkSize = 64 * 1024; // 64KB chunks for progress reporting

    const readable = new Readable({
      read() {
        const chunk = buffer.slice(uploaded, uploaded + progressChunkSize);
        if (chunk.length > 0) {
          uploaded += chunk.length;
          const percent = Math.round((uploaded / total) * 100);
          panel.webview.postMessage({
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
 * Collects all folder paths from the provider's cache.
 */
function collectFolderOptions(provider: CloudinaryTreeDataProvider): FolderOption[] {
  const folders: FolderOption[] = [{ path: "", label: "/ (root)" }];

  // Get folders from provider's cache
  const cachedFolders = provider.getAvailableFolders();
  for (const folder of cachedFolders) {
    folders.push({
      path: folder.path,
      label: folder.path,
    });
  }

  return folders;
}

/**
 * Creates the webview panel with custom upload UI.
 */
function createUploadPanel(
  provider: CloudinaryTreeDataProvider,
  context: vscode.ExtensionContext
): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    "cloudinaryUploadWidget",
    "Upload to Cloudinary",
    vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true }
  );

  // Set the panel icon to the Cloudinary logo
  panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "resources", "cloudinary_icon_blue.png");

  const currentPreset = provider.getCurrentUploadPreset() || "";
  const cloudName = provider.cloudName!;
  const folders = collectFolderOptions(provider);

  // Set up the webview HTML content
  panel.webview.html = getWebviewContent(
    currentPreset,
    provider,
    currentFolderPath,
    cloudName,
    folders
  );

  // Handle messages from the webview
  panel.webview.onDidReceiveMessage(async (message: {
    command: string;
    fileId?: string;
    fileName?: string;
    dataUri?: string;
    url?: string;
    preset?: string;
    text?: string;
    folderPath?: string;
    publicId?: string;
    tags?: string;
    asset?: any;
  }) => {
    // Update current folder when changed in webview
    if (message.command === "folderChanged" && message.folderPath !== undefined) {
      currentFolderPath = message.folderPath;
      return;
    }

    // Get upload options based on current preset, folder, and optional overrides
    // Upload preset is optional - signed uploads work without one
    const getUploadOptions = (presetName: string | null | undefined, folder: string, publicId?: string, tags?: string, fileName?: string) => {
      const options: Record<string, any> = {
        resource_type: "auto",
      };

      // Only add upload_preset if one is selected (not null, undefined, or empty string)
      if (presetName && presetName.trim()) {
        options.upload_preset = presetName;
      }

      // Add folder configuration
      if (folder) {
        if (provider.dynamicFolders) {
          options.asset_folder = folder;
        } else {
          options.folder = folder;
        }
      }

      // Preserve original filename when uploading data URIs
      // This prevents Cloudinary from defaulting to "file" for original_filename
      if (fileName) {
        options.filename_override = fileName;

        // For dynamic folders, also set display_name from original filename
        if (provider.dynamicFolders) {
          // Remove file extension for display_name
          const displayName = fileName.replace(/\.[^/.]+$/, "");
          options.display_name = displayName;
        }
      }

      // Add custom public_id if provided
      if (publicId && publicId.trim()) {
        options.public_id = publicId.trim();
      }

      // Add tags if provided (comma-separated string)
      if (tags && tags.trim()) {
        options.tags = tags.split(",").map((t: string) => t.trim()).filter((t: string) => t);
      }

      return options;
    };

    if (message.command === "uploadFile" && message.dataUri && message.fileId) {
      // Use nullish coalescing - empty string "" means "no preset" (signed upload)
      const presetName = message.preset !== undefined ? message.preset : currentPreset;
      const folder = message.folderPath !== undefined ? message.folderPath : currentFolderPath;
      const options = getUploadOptions(presetName, folder, message.publicId, message.tags, message.fileName);

      try {
        panel.webview.postMessage({
          command: "uploadStarted",
          fileId: message.fileId,
        });

        const result = await uploadWithProgress(
          panel,
          message.dataUri,
          options,
          message.fileId
        );

        // Include folder info and original filename in the result for display
        result._uploadedToFolder = folder || "(root)";
        result._originalFileName = message.fileName;

        panel.webview.postMessage({
          command: "uploadComplete",
          fileId: message.fileId,
          asset: result,
        });

        vscode.commands.executeCommand("cloudinary.refresh");
      } catch (err: any) {
        panel.webview.postMessage({
          command: "uploadError",
          fileId: message.fileId,
          error: err.message || "Upload failed",
        });
        vscode.window.showErrorMessage(`Upload failed: ${err.message}`);
      }
    }

    if (message.command === "uploadUrl" && message.url) {
      // Use nullish coalescing - empty string "" means "no preset" (signed upload)
      const presetName = message.preset !== undefined ? message.preset : currentPreset;
      const folder = message.folderPath !== undefined ? message.folderPath : currentFolderPath;
      // Try to extract filename from URL for display_name
      let urlFileName: string | undefined;
      try {
        const urlPath = new URL(message.url).pathname;
        const lastSegment = urlPath.split('/').pop();
        if (lastSegment && lastSegment.includes('.')) {
          urlFileName = lastSegment;
        }
      } catch {
        // Invalid URL, skip filename extraction
      }
      const options = getUploadOptions(presetName, folder, message.publicId, message.tags, urlFileName);
      const fileId = message.fileId || `url-${Date.now()}`;

      try {
        panel.webview.postMessage({
          command: "uploadStarted",
          fileId,
          fileName: message.url,
        });

        // URL uploads don't support progress tracking, so we simulate it
        panel.webview.postMessage({
          command: "uploadProgress",
          fileId,
          percent: 50,
        });

        const result = await cloudinary.uploader.upload(message.url, options);

        // Include folder info and original filename in the result for display
        result._uploadedToFolder = folder || "(root)";
        result._originalFileName = urlFileName;

        panel.webview.postMessage({
          command: "uploadComplete",
          fileId,
          asset: result,
        });

        vscode.commands.executeCommand("cloudinary.refresh");
      } catch (err: any) {
        panel.webview.postMessage({
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
      // Refresh folder list from provider
      const updatedFolders = collectFolderOptions(provider);
      panel.webview.postMessage({
        command: "updateFolders",
        folders: updatedFolders,
      });
    }

    if (message.command === "openAsset" && message.asset) {
      // Transform upload response to match expected AssetData format for preview
      const asset = message.asset;
      const assetType = asset.resource_type || 'raw';

      // Generate optimized URL (same logic as cloudinaryItem.ts)
      const optimizedUrl = assetType === 'raw'
        ? cloudinary.url(asset.public_id, {
          resource_type: 'raw',
          type: asset.type,
        })
        : cloudinary.url(asset.public_id, {
          resource_type: assetType,
          type: asset.type,
          transformation: [
            { fetch_format: assetType === 'video' ? 'auto:video' : 'auto' },
            { quality: 'auto' }
          ],
        });

      // Determine the best filename to use
      // Prefer our stored original filename, then Cloudinary's original_filename (if not "file"), then public_id
      let filename = asset._originalFileName
        || (asset.original_filename && asset.original_filename !== 'file' ? asset.original_filename : null)
        || asset.public_id.split('/').pop()
        || asset.public_id;

      // Enrich asset data with fields expected by preview
      const enrichedAsset = {
        ...asset,
        displayType: assetType,
        optimized_url: optimizedUrl,
        filename: filename,
      };

      // Open the asset in preview panel
      vscode.commands.executeCommand("cloudinary.openAsset", enrichedAsset);
    }
  });

  return panel;
}

/**
 * Generates the HTML content for the custom upload webview.
 */
function getWebviewContent(
  currentPreset: string,
  provider: CloudinaryTreeDataProvider,
  initialFolderPath: string,
  cloudName: string,
  folders: FolderOption[]
): string {
  // Serialize presets for JavaScript
  const presetsJson = JSON.stringify(provider.uploadPresets);

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Upload to Cloudinary</title>
    <style>
      /* Reset and base */
      *, *::before, *::after {
        box-sizing: border-box;
      }

      body {
        font-family: var(--vscode-font-family);
        background-color: var(--vscode-editor-background);
        color: var(--vscode-editor-foreground);
        margin: 0;
        padding: 1rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }

      /* Main container */
      .upload-panel {
        background-color: var(--vscode-editorWidget-background);
        padding: 1.25rem;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        max-width: 750px;
        width: 100%;
      }

      .upload-panel h2 {
        margin: 0 0 1rem 0;
        font-size: 1.15rem;
        font-weight: 600;
        color: var(--vscode-editor-foreground);
      }

      /* Settings row */
      .settings-row {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }

      .setting-group {
        flex: 1;
        min-width: 200px;
        background-color: var(--vscode-editor-background);
        border-radius: 6px;
        padding: 0.65rem 0.85rem;
        border: 1px solid var(--vscode-editorWidget-border);
      }

      .setting-group.full-width {
        flex: 100%;
        min-width: 100%;
      }

      .setting-label {
        font-size: 0.75rem;
        font-weight: 600;
        margin: 0 0 0.4rem 0;
        color: var(--vscode-descriptionForeground);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .setting-group select,
      .setting-group input[type="text"] {
        width: 100%;
        background-color: var(--vscode-dropdown-background);
        color: var(--vscode-dropdown-foreground);
        border: 1px solid var(--vscode-dropdown-border);
        padding: 0.4rem 0.6rem;
        border-radius: 4px;
        font-size: 0.85rem;
      }

      .setting-group input[type="text"] {
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border-color: var(--vscode-input-border);
      }

      .setting-group input[type="text"]:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }

      .setting-group input[type="text"]::placeholder {
        color: var(--vscode-input-placeholderForeground);
      }

      .input-hint {
        font-size: 0.7rem;
        color: var(--vscode-descriptionForeground);
        margin-top: 0.25rem;
        font-weight: normal;
      }

      /* Preset details toggle */
      .preset-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .preset-details-toggle {
        background: none;
        border: none;
        color: var(--vscode-textLink-foreground);
        cursor: pointer;
        padding: 0;
        font-size: 0.7rem;
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .preset-details-toggle::before {
        content: '▶';
        font-size: 0.55rem;
        transition: transform 0.2s;
      }

      .preset-details-toggle.expanded::before {
        transform: rotate(90deg);
      }

      .preset-details {
        margin-top: 0.5rem;
        padding: 0.5rem;
        background-color: var(--vscode-editor-background);
        border-radius: 4px;
        font-size: 0.7rem;
        font-family: var(--vscode-editor-font-family, monospace);
        white-space: pre-wrap;
        max-height: 150px;
        overflow-y: auto;
        border: 1px solid var(--vscode-editorWidget-border);
        display: none;
        color: var(--vscode-descriptionForeground);
      }

      .preset-details.visible {
        display: block;
      }

      /* Collapsible section */
      .collapsible-section {
        margin-bottom: 1rem;
      }

      .collapsible-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        padding: 0.5rem 0;
        user-select: none;
      }

      .collapsible-header::before {
        content: '▶';
        font-size: 0.65rem;
        transition: transform 0.2s;
        color: var(--vscode-descriptionForeground);
      }

      .collapsible-header.expanded::before {
        transform: rotate(90deg);
      }

      .collapsible-header span {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--vscode-descriptionForeground);
      }

      .collapsible-content {
        display: none;
        padding-top: 0.5rem;
      }

      .collapsible-content.visible {
        display: block;
      }

      /* Tabs */
      .upload-tabs {
        display: flex;
        gap: 0;
        margin-bottom: 1rem;
        border-bottom: 1px solid var(--vscode-editorWidget-border);
      }

      .tab {
        background: none;
        border: none;
        padding: 0.65rem 1.25rem;
        font-size: 0.85rem;
        cursor: pointer;
        color: var(--vscode-descriptionForeground);
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: color 0.2s, border-color 0.2s;
      }

      .tab:hover {
        color: var(--vscode-editor-foreground);
      }

      .tab.active {
        color: var(--vscode-textLink-foreground);
        border-bottom-color: var(--vscode-textLink-foreground);
        font-weight: 500;
      }

      /* Tab content */
      .tab-content {
        display: none;
      }

      .tab-content.active {
        display: block;
      }

      /* Drop zone */
      .drop-zone {
        border: 2px dashed var(--vscode-editorWidget-border);
        border-radius: 10px;
        padding: 2.5rem 1.5rem;
        text-align: center;
        transition: border-color 0.2s, background-color 0.2s;
        background-color: var(--vscode-editor-background);
      }

      .drop-zone:hover,
      .drop-zone.drag-over {
        border-color: var(--vscode-focusBorder);
        background-color: rgba(0, 120, 212, 0.05);
      }

      .drop-zone-icon {
        margin-bottom: 0.75rem;
        color: var(--vscode-textLink-foreground);
        opacity: 0.8;
      }

      .drop-zone p {
        margin: 0.4rem 0;
        color: var(--vscode-descriptionForeground);
        font-size: 0.9rem;
      }

      .drop-zone .or-text {
        margin: 0.75rem 0;
        font-size: 0.8rem;
        opacity: 0.6;
      }

      .browse-btn {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 0.6rem 1.5rem;
        border-radius: 4px;
        font-size: 0.85rem;
        cursor: pointer;
        margin-top: 0.5rem;
        transition: background-color 0.2s;
      }

      .browse-btn:hover {
        background-color: var(--vscode-button-hoverBackground);
      }

      /* URL input */
      .url-input-group {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .url-input {
        flex: 1;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 0.6rem 0.85rem;
        border-radius: 4px;
        font-size: 0.85rem;
      }

      .url-input:focus {
        outline: none;
        border-color: var(--vscode-focusBorder);
      }

      .upload-url-btn {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 0.6rem 1.25rem;
        border-radius: 4px;
        font-size: 0.85rem;
        cursor: pointer;
        transition: background-color 0.2s;
        white-space: nowrap;
      }

      .upload-url-btn:hover {
        background-color: var(--vscode-button-hoverBackground);
      }

      .upload-url-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Upload queue */
      #upload-queue {
        margin-top: 1rem;
      }

      #upload-queue:empty {
        display: none;
      }

      .queue-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem 0.75rem;
        background: var(--vscode-editor-background);
        border-radius: 6px;
        margin-bottom: 0.5rem;
        border: 1px solid var(--vscode-editorWidget-border);
      }

      .queue-item .file-name {
        flex: 1;
        font-size: 0.8rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }

      .queue-item .progress-bar {
        flex: 2;
        height: 6px;
        background: var(--vscode-progressBar-background);
        border-radius: 3px;
        overflow: hidden;
      }

      .queue-item .progress {
        height: 100%;
        background: var(--vscode-progressBar-foreground, #0078d4);
        transition: width 0.15s ease-out;
        border-radius: 3px;
      }

      .queue-item .status {
        font-size: 0.75rem;
        color: var(--vscode-descriptionForeground);
        min-width: 80px;
        text-align: right;
      }

      .queue-item.complete .progress {
        background: var(--vscode-testing-iconPassed, #4caf50);
      }

      .queue-item.complete .status {
        color: var(--vscode-testing-iconPassed, #4caf50);
      }

      .queue-item.error .progress {
        background: var(--vscode-testing-iconFailed, #f44336);
      }

      .queue-item.error .status {
        color: var(--vscode-testing-iconFailed, #f44336);
      }

      /* Uploaded assets section */
      #uploaded-assets {
        margin-top: 1.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--vscode-editorWidget-border);
      }

      #uploaded-assets.hidden {
        display: none;
      }

      .assets-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
      }

      .assets-header h3 {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 600;
      }

      .clear-btn {
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        padding: 0.35rem 0.75rem;
        border-radius: 4px;
        font-size: 0.75rem;
        cursor: pointer;
        transition: background-color 0.15s;
      }

      .clear-btn:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }

      #asset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 1rem;
      }

      .asset-card {
        background: var(--vscode-editor-background);
        border: 1px solid var(--vscode-editorWidget-border);
        border-radius: 8px;
        padding: 0.6rem;
        text-align: center;
        transition: border-color 0.2s, transform 0.15s;
      }

      .asset-card:hover {
        border-color: var(--vscode-focusBorder);
        transform: translateY(-2px);
      }

      .asset-card .thumbnail-wrapper {
        cursor: pointer;
        position: relative;
      }

      .asset-card .thumbnail-wrapper:hover::after {
        content: '🔍';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 1.5rem;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .asset-card .thumbnail {
        width: 130px;
        height: 100px;
        object-fit: cover;
        border-radius: 6px;
        background: var(--vscode-editorWidget-background);
      }

      .asset-card .file-icon {
        width: 130px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--vscode-editorWidget-background);
        border-radius: 6px;
        color: var(--vscode-descriptionForeground);
      }

      .asset-card .asset-folder {
        font-size: 0.65rem;
        color: var(--vscode-descriptionForeground);
        margin: 0.35rem 0 0.2rem 0;
        opacity: 0.8;
      }

      .asset-card .asset-folder code {
        background: var(--vscode-badge-background);
        color: var(--vscode-badge-foreground);
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
        font-size: 0.6rem;
      }

      .asset-card .public-id {
        font-size: 0.7rem;
        color: var(--vscode-descriptionForeground);
        margin: 0.3rem 0;
        word-break: break-all;
        max-height: 2.4em;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .asset-card .actions {
        display: flex;
        gap: 0.35rem;
        justify-content: center;
        flex-wrap: wrap;
      }

      .asset-card .actions button {
        font-size: 0.7rem;
        padding: 0.3rem 0.55rem;
        background-color: var(--vscode-button-secondaryBackground);
        color: var(--vscode-button-secondaryForeground);
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.15s;
      }

      .asset-card .actions button:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
      }

      .asset-card .actions button.copied {
        background-color: var(--vscode-testing-iconPassed, #4caf50);
        color: white;
      }
    </style>
  </head>
  <body>
    <div class="upload-panel">
      <h2>Upload to Cloudinary</h2>

      <!-- Settings Row -->
      <div class="settings-row">
        <!-- Folder Selector -->
        <div class="setting-group">
          <div class="setting-label">Destination Folder</div>
          <select id="folderSelect">
            ${folders
      .map(
        (folder) => `
              <option value="${folder.path}" ${folder.path === initialFolderPath ? "selected" : ""}>
                ${folder.label}
              </option>
            `
      )
      .join("")}
          </select>
        </div>

        <!-- Preset Selector -->
        <div class="setting-group">
          <div class="preset-header">
            <div class="setting-label">Upload Preset <span style="opacity: 0.7; font-weight: normal;">(optional)</span></div>
            ${provider.uploadPresets.length > 0 ? '<button class="preset-details-toggle" id="presetDetailsToggle">Settings</button>' : ''}
          </div>
          <select id="presetSelect">
            <option value="">No preset (signed upload)</option>
            ${provider.uploadPresets
      .map(
        (preset) => `
              <option value="${preset.name}" ${preset.name === currentPreset ? "selected" : ""}>
                ${preset.name} (${preset.signed ? "Signed" : "Unsigned"})
              </option>
            `
      )
      .join("")}
          </select>
          <div class="preset-details" id="presetDetails"></div>
        </div>
      </div>

      <!-- Advanced Options (Collapsible) -->
      <div class="collapsible-section">
        <div class="collapsible-header" id="advancedHeader">
          <span>Advanced Options</span>
        </div>
        <div class="collapsible-content" id="advancedContent">
          <div class="settings-row">
            <div class="setting-group">
              <div class="setting-label">Custom Public ID</div>
              <input type="text" id="publicIdInput" placeholder="Leave empty for auto-generated" />
              <div class="input-hint">Only applied to single file uploads</div>
            </div>
            <div class="setting-group">
              <div class="setting-label">Tags</div>
              <input type="text" id="tagsInput" placeholder="tag1, tag2, tag3" />
              <div class="input-hint">Comma-separated list of tags</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Upload Tabs -->
      <div class="upload-tabs">
        <button class="tab active" data-tab="local">Local Files</button>
        <button class="tab" data-tab="url">Remote URL</button>
      </div>

      <!-- Local Files Tab -->
      <div class="tab-content active" id="local">
        <div class="drop-zone" id="dropZone">
          <div class="drop-zone-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
            </svg>
          </div>
          <p>Drag & drop files here</p>
          <p class="or-text">— or —</p>
          <button class="browse-btn" id="browseBtn">Browse Files</button>
          <input type="file" id="fileInput" multiple hidden />
        </div>
      </div>

      <!-- URL Tab -->
      <div class="tab-content" id="url">
        <div class="url-input-group">
          <input type="text" class="url-input" id="urlInput" placeholder="https://example.com/image.jpg" />
          <button class="upload-url-btn" id="uploadUrlBtn">Upload</button>
        </div>
      </div>

      <!-- Upload Queue -->
      <div id="upload-queue"></div>

      <!-- Uploaded Assets -->
      <div id="uploaded-assets" class="hidden">
        <div class="assets-header">
          <h3>✅ Uploaded Assets</h3>
          <button class="clear-btn" id="clearBtn">Clear All</button>
        </div>
        <div id="asset-grid"></div>
      </div>
    </div>

    <script>
      const vscode = acquireVsCodeApi();
      const cloudName = "${cloudName}";
      const presets = ${presetsJson};

      // Elements
      const tabs = document.querySelectorAll('.tab');
      const tabContents = document.querySelectorAll('.tab-content');
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

      /**
       * Format preset settings for display
       */
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

      /**
       * Update preset details display
       */
      function updatePresetDetails() {
        const selectedValue = presetSelect.value;
        if (!selectedValue) {
          // No preset selected - using signed upload
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

      /**
       * Toggle preset details visibility
       */
      if (presetDetailsToggle) {
        presetDetailsToggle.addEventListener('click', () => {
          const isVisible = presetDetails.classList.toggle('visible');
          presetDetailsToggle.classList.toggle('expanded', isVisible);
          presetDetailsToggle.textContent = isVisible ? 'Hide' : 'Settings';
        });
      }

      /**
       * Update preset details when selection changes
       */
      presetSelect.addEventListener('change', updatePresetDetails);

      /**
       * Toggle advanced options
       */
      advancedHeader.addEventListener('click', () => {
        advancedHeader.classList.toggle('expanded');
        advancedContent.classList.toggle('visible');
      });

      /**
       * Generate unique file ID
       */
      function generateId() {
        return 'file-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }

      /**
       * Get current preset (returns null if no preset selected)
       */
      function getCurrentPreset() {
        return presetSelect.value || null;
      }

      /**
       * Get current folder
       */
      function getCurrentFolder() {
        return folderSelect.value;
      }

      /**
       * Get custom public ID (if single file)
       */
      function getPublicId() {
        return publicIdInput.value.trim();
      }

      /**
       * Get tags
       */
      function getTags() {
        return tagsInput.value.trim();
      }

      /**
       * Notify extension when folder changes
       */
      folderSelect.addEventListener('change', () => {
        vscode.postMessage({
          command: 'folderChanged',
          folderPath: getCurrentFolder()
        });
      });

      /**
       * Tab switching
       */
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          tabs.forEach(t => t.classList.remove('active'));
          tabContents.forEach(c => c.classList.remove('active'));

          tab.classList.add('active');
          const tabId = tab.getAttribute('data-tab');
          document.getElementById(tabId).classList.add('active');
        });
      });

      /**
       * Browse files
       */
      browseBtn.addEventListener('click', () => {
        fileInput.click();
      });

      /**
       * Handle file selection
       */
      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        processFiles(files);
        fileInput.value = ''; // Reset for re-selection
      });

      /**
       * Drag and drop handling
       */
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

      /**
       * Process files for upload
       */
      function processFiles(files) {
        const customPublicId = getPublicId();
        const tags = getTags();

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileId = generateId();

          // Add to queue UI
          addToQueue(fileId, file.name);

          // Read file as data URI
          const reader = new FileReader();
          reader.onload = () => {
            vscode.postMessage({
              command: 'uploadFile',
              fileId: fileId,
              fileName: file.name,
              dataUri: reader.result,
              preset: getCurrentPreset(),
              folderPath: getCurrentFolder(),
              // Only apply custom public_id to first file if multiple
              publicId: (files.length === 1) ? customPublicId : '',
              tags: tags
            });
          };
          reader.onerror = () => {
            updateQueueItem(fileId, 'error', 0, 'Failed to read file');
          };
          reader.readAsDataURL(file);
        }

        // Clear public ID after upload (it's typically unique per asset)
        if (files.length === 1 && customPublicId) {
          publicIdInput.value = '';
        }
      }

      /**
       * URL upload
       */
      uploadUrlBtn.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) return;

        const fileId = generateId();
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
        publicIdInput.value = ''; // Clear after use
      });

      urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          uploadUrlBtn.click();
        }
      });

      /**
       * Clear uploaded assets and queue
       */
      clearBtn.addEventListener('click', () => {
        assetGrid.innerHTML = '';
        uploadQueue.innerHTML = '';
        uploadedAssets.classList.add('hidden');
        queue.clear();
      });

      /**
       * Add item to queue UI
       */
      function addToQueue(fileId, fileName) {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.setAttribute('data-file-id', fileId);

        const displayName = fileName.length > 30
          ? fileName.substring(0, 15) + '...' + fileName.slice(-12)
          : fileName;

        item.innerHTML = \`
          <span class="file-name" title="\${fileName}">\${displayName}</span>
          <div class="progress-bar">
            <div class="progress" style="width: 0%"></div>
          </div>
          <span class="status">Pending...</span>
        \`;

        uploadQueue.appendChild(item);
        queue.set(fileId, { fileName, status: 'pending', progress: 0 });
      }

      /**
       * Update queue item
       */
      function updateQueueItem(fileId, status, progress, errorMsg) {
        const item = uploadQueue.querySelector(\`[data-file-id="\${fileId}"]\`);
        if (!item) return;

        const progressBar = item.querySelector('.progress');
        const statusEl = item.querySelector('.status');

        item.className = 'queue-item';
        if (status === 'complete') item.classList.add('complete');
        if (status === 'error') item.classList.add('error');

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

      /**
       * Generate thumbnail URL
       */
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

      /**
       * Get file icon SVG for raw files (uses single quotes for safe inline use)
       */
      function getFileIcon(format) {
        // Generic file icon SVG - using single quotes for attributes to avoid breaking inline handlers
        return "<svg width='48' height='48' viewBox='0 0 24 24' fill='currentColor'><path d='M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM9 13H15V15H9V13ZM9 17H15V19H9V17Z'/></svg>";
      }

      /**
       * Open asset in preview
       */
      function openAssetPreview(asset) {
        vscode.postMessage({
          command: 'openAsset',
          asset: asset
        });
      }

      /**
       * Render uploaded asset card
       */
      function renderUploadedAsset(asset) {
        uploadedAssets.classList.remove('hidden');

        const thumbnailUrl = getThumbnailUrl(asset);
        const folderDisplay = asset._uploadedToFolder || '(root)';

        const card = document.createElement('div');
        card.className = 'asset-card';

        let mediaHtml;
        if (thumbnailUrl) {
          mediaHtml = \`
            <div class="thumbnail-wrapper" data-asset-id="\${asset.public_id}">
              <img class="thumbnail" src="\${thumbnailUrl}" alt="Thumbnail" />
              <div class="file-icon fallback" style="display:none;">\${getFileIcon(asset.format)}</div>
            </div>
          \`;
        } else {
          mediaHtml = \`
            <div class="thumbnail-wrapper" data-asset-id="\${asset.public_id}">
              <div class="file-icon">\${getFileIcon(asset.format)}</div>
            </div>
          \`;
        }

        const displayId = asset.public_id.length > 25
          ? '...' + asset.public_id.slice(-22)
          : asset.public_id;

        card.innerHTML = \`
          \${mediaHtml}
          <div class="asset-folder">📂 <code>\${folderDisplay}</code></div>
          <div class="public-id" title="\${asset.public_id}">\${displayId}</div>
          <div class="actions">
            <button onclick="copyToClipboard(this, '\${asset.secure_url}')">Copy URL</button>
            <button onclick="copyToClipboard(this, '\${asset.public_id}')">Copy ID</button>
          </div>
        \`;

        // Store asset data for click handler
        card._assetData = asset;

        // Add click handler to thumbnail
        const thumbnailWrapper = card.querySelector('.thumbnail-wrapper');
        thumbnailWrapper.addEventListener('click', () => {
          openAssetPreview(asset);
        });

        // Handle image load errors - show fallback icon
        const img = card.querySelector('.thumbnail');
        if (img) {
          img.addEventListener('error', function() {
            this.style.display = 'none';
            const fallback = this.parentElement.querySelector('.fallback');
            if (fallback) {
              fallback.style.display = 'flex';
            }
          });
        }

        assetGrid.insertBefore(card, assetGrid.firstChild);
      }

      /**
       * Copy to clipboard
       */
      function copyToClipboard(button, text) {
        navigator.clipboard.writeText(text).then(() => {
          const originalText = button.textContent;
          button.textContent = 'Copied!';
          button.classList.add('copied');
          setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
          }, 1500);
        }).catch(() => {
          vscode.postMessage({ command: 'copyToClipboard', text: text });
        });
      }

      /**
       * Handle messages from extension
       */
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
            // Update folder selection when extension requests
            if (message.folderPath !== undefined) {
              folderSelect.value = message.folderPath;
            }
            break;

          case 'updateFolders':
            // Update folder options
            if (message.folders) {
              const currentValue = folderSelect.value;
              folderSelect.innerHTML = message.folders.map(f => 
                \`<option value="\${f.path}" \${f.path === currentValue ? 'selected' : ''}>\${f.label}</option>\`
              ).join('');
            }
            break;
        }
      });
    </script>
  </body>
  </html>
  `;
}

export default registerUpload;

