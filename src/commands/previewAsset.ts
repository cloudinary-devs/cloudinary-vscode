import * as vscode from "vscode";
import { createWebviewDocument } from "../webview/webviewUtils";
import { escapeHtml, formatFileSize } from "../webview/utils/helpers";
import { assetIcons, actionIcons } from "../webview/icons";

type AssetData = {
  public_id: string;
  displayType: "image" | "video" | string;
  secure_url: string;
  optimized_url: string;
  bytes: number;
  width: number;
  height: number;
  filename: string;
  format?: string;
  resource_type?: string;
  tags?: string[];
  context?: Record<string, any>;
  metadata?: Record<string, any>;
};

/**
 * Map of open preview panels by public_id.
 */
const openPanels: Map<string, vscode.WebviewPanel> = new Map();

/**
 * Get icon for asset type using centralized icons.
 */
function getAssetIcon(type: string): string {
  switch (type) {
    case "image":
      return assetIcons.image("lg");
    case "video":
      return assetIcons.video("lg");
    default:
      return assetIcons.file("lg");
  }
}

function registerPreview(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "cloudinary.openAsset",
      (asset: AssetData) => {
        const publicId = asset.public_id;

        // Check if panel for this asset already exists
        const existingPanel = openPanels.get(publicId);
        if (existingPanel) {
          existingPanel.reveal(vscode.ViewColumn.One);
          return;
        }

        // Get short display name for tab
        const shortName = asset.public_id.includes("/")
          ? asset.public_id.split("/").pop()
          : asset.public_id;

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
          "cloudinaryAssetPreview",
          shortName || asset.public_id,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            localResourceRoots: [
              vscode.Uri.joinPath(context.extensionUri, "src", "webview", "media"),
            ],
          }
        );

        // Set the panel icon based on asset type
        const iconFile =
          asset.displayType === "image"
            ? "icon-image.svg"
            : asset.displayType === "video"
              ? "icon-video.svg"
              : "icon-file.svg";
        panel.iconPath = vscode.Uri.joinPath(
          context.extensionUri,
          "resources",
          iconFile
        );

        // Track this panel
        openPanels.set(publicId, panel);

        // Remove from tracking when disposed
        panel.onDidDispose(() => {
          openPanels.delete(publicId);
        });

        // Set the HTML content
        panel.webview.html = createWebviewDocument({
          title: asset.public_id,
          webview: panel.webview,
          extensionUri: context.extensionUri,
          bodyContent: getPreviewContent(asset),
          bodyClass: "layout-centered",
          inlineScript: "initCommon();",
        });

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
          if (message.command === "copyToClipboard" && message.text) {
            await vscode.env.clipboard.writeText(message.text);
          }
        });
      }
    )
  );
}

/**
 * Get asset type icon.
 */
function getAssetTypeIcon(type: string): string {
  return getAssetIcon(type);
}

/**
 * Build the preview section HTML based on asset type.
 */
function buildPreviewHtml(asset: AssetData): { html: string; hasEnlarge: boolean } {
  const displayName = asset.public_id.includes("/")
    ? asset.public_id.split("/").pop()
    : asset.public_id;

  if (asset.displayType === "image") {
    return {
      html: `
        <div class="preview-container" id="previewContainer">
          <img src="${escapeHtml(asset.optimized_url)}" alt="${escapeHtml(asset.public_id)}" class="preview-container__media" />
          <button class="preview-container__enlarge" id="enlargeBtn" title="View full size">
            ${actionIcons.enlarge("md")}
          </button>
        </div>
      `,
      hasEnlarge: true,
    };
  }

  if (asset.displayType === "video") {
    return {
      html: `
        <div class="preview-container" id="previewContainer">
          <video controls class="preview-container__media">
            <source src="${escapeHtml(asset.secure_url)}" type="video/mp4">
          </video>
          <button class="preview-container__enlarge" id="enlargeBtn" title="View full size">
            ${actionIcons.enlarge("md")}
          </button>
        </div>
      `,
      hasEnlarge: true,
    };
  }

  // Raw file
  return {
    html: `
      <div class="raw-file-preview">
        <div class="raw-file-preview__icon">
          ${assetIcons.file("xl")}
        </div>
        <p class="raw-file-preview__name">${escapeHtml(displayName || "")}</p>
        <a href="${escapeHtml(asset.optimized_url)}" target="_blank" class="btn btn--primary">
          ${actionIcons.download("sm")} Download File
        </a>
      </div>
    `,
    hasEnlarge: false,
  };
}

/**
 * Build the tags HTML.
 */
function buildTagsHtml(tags?: string[]): string {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '<p class="meta-section__empty">No tags</p>';
  }
  return `<div class="meta-tags">${tags.map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join("")}</div>`;
}

/**
 * Build metadata section HTML.
 */
function buildMetadataHtml(data: Record<string, any> | undefined, emptyText: string): string {
  if (!data || Object.keys(data).length === 0) {
    return `<p class="meta-section__empty">${escapeHtml(emptyText)}</p>`;
  }
  return Object.entries(data)
    .map(
      ([key, value]) => `
        <div class="info-row">
          <span class="info-row__label">${escapeHtml(key)}</span>
          <span class="info-row__value">${escapeHtml(String(value))}</span>
        </div>
      `
    )
    .join("");
}

/**
 * Build the lightbox HTML.
 */
function buildLightboxHtml(asset: AssetData): string {
  const content =
    asset.displayType === "image"
      ? `<img src="${escapeHtml(asset.secure_url)}" alt="${escapeHtml(asset.public_id)}" class="lightbox__content" />`
      : `<video controls class="lightbox__content"><source src="${escapeHtml(asset.secure_url)}" type="video/mp4"></video>`;

  return `
    <div class="lightbox" id="lightbox">
      <button class="lightbox__close">×</button>
      ${content}
    </div>
  `;
}

/**
 * Generate the body content for the asset preview panel.
 */
function getPreviewContent(asset: AssetData): string {
  const displayName = asset.public_id.includes("/")
    ? asset.public_id.split("/").pop()
    : asset.public_id;

  const typeIcon = getAssetTypeIcon(asset.displayType);
  const { html: previewHtml, hasEnlarge } = buildPreviewHtml(asset);
  const tagsHtml = buildTagsHtml(asset.tags);
  const contextHtml = buildMetadataHtml(asset.context, "No context metadata");
  const metadataHtml = buildMetadataHtml(asset.metadata, "No structured metadata");
  const lightboxHtml = hasEnlarge ? buildLightboxHtml(asset) : "";

  return `
    <div class="card card--elevated" style="max-width: 600px; width: 100%;">
      <div class="card__body">
        <!-- Header -->
        <div class="asset-header">
          <span class="asset-header__icon">${typeIcon}</span>
          <div class="asset-header__content">
            <h2 class="asset-header__title" title="${escapeHtml(asset.public_id)}">${escapeHtml(displayName || "")}</h2>
            <div class="asset-header__subtitle">
              <span class="badge">${escapeHtml((asset.format || asset.displayType || "unknown").toUpperCase())}</span>
              ${asset.width && asset.height ? `${asset.width} × ${asset.height}` : ""}
              ${asset.bytes ? ` • ${formatFileSize(asset.bytes)}` : ""}
            </div>
          </div>
        </div>

        ${previewHtml}

        <!-- Tabs -->
        <div class="tabs" role="tablist">
          <nav class="tabs__nav">
            <button class="tabs__btn active" data-tab="info" role="tab">Info</button>
            <button class="tabs__btn" data-tab="meta" role="tab">Metadata</button>
            <button class="tabs__btn" data-tab="urls" role="tab">URLs</button>
          </nav>

          <div class="tabs__content active" id="tab-info" role="tabpanel">
            <div class="info-row">
              <span class="info-row__label">Public ID</span>
              <span class="info-row__value">
                <span>${escapeHtml(asset.public_id)}</span>
                <button class="btn btn--secondary btn--sm btn--copy" data-copy="${escapeHtml(asset.public_id)}">Copy</button>
              </span>
            </div>
            <div class="info-row">
              <span class="info-row__label">Original Filename</span>
              <span class="info-row__value">${escapeHtml(asset.filename || "N/A")}</span>
            </div>
            <div class="info-row">
              <span class="info-row__label">Dimensions</span>
              <span class="info-row__value">${asset.width && asset.height ? `${asset.width} × ${asset.height} px` : "N/A"}</span>
            </div>
            <div class="info-row">
              <span class="info-row__label">File Size</span>
              <span class="info-row__value">${asset.bytes ? formatFileSize(asset.bytes) : "N/A"}</span>
            </div>
            <div class="info-row">
              <span class="info-row__label">Type</span>
              <span class="info-row__value">${escapeHtml(asset.displayType || "unknown")}</span>
            </div>
          </div>

          <div class="tabs__content" id="tab-meta" role="tabpanel">
            <div class="meta-section">
              <div class="meta-section__title">Tags</div>
              ${tagsHtml}
            </div>
            <div class="meta-section">
              <div class="meta-section__title">Context Metadata</div>
              ${contextHtml}
            </div>
            <div class="meta-section">
              <div class="meta-section__title">Structured Metadata</div>
              ${metadataHtml}
            </div>
          </div>

          <div class="tabs__content" id="tab-urls" role="tabpanel">
            <div class="url-item">
              <div class="url-item__label">Original URL</div>
              <div class="url-item__value">
                <a href="${escapeHtml(asset.secure_url)}" target="_blank" class="url-item__link">${escapeHtml(asset.secure_url)}</a>
                <button class="btn btn--secondary btn--sm btn--copy" data-copy="${escapeHtml(asset.secure_url)}">Copy</button>
              </div>
            </div>
            <div class="url-item">
              <div class="url-item__label">Optimized URL</div>
              <div class="url-item__value">
                <a href="${escapeHtml(asset.optimized_url)}" target="_blank" class="url-item__link">${escapeHtml(asset.optimized_url)}</a>
                <button class="btn btn--secondary btn--sm btn--copy" data-copy="${escapeHtml(asset.optimized_url)}">Copy</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    ${lightboxHtml}
  `;
}

export default registerPreview;
