// === 📁 src/tree/cloudinaryItem.ts ===
import * as vscode from 'vscode';
import { v2 as cloudinary } from 'cloudinary';

export type CloudinaryItemType = 'asset' | 'folder' | 'loadMore' | 'divider' | 'clearSearch';

interface AssetData {
  public_id: string;
  display_name?: string;
  resource_type: string;
  type?: string;
  [key: string]: any;
}

interface FolderData {
  name?: string;
  path?: string;
  [key: string]: any;
}

interface LoadMoreData {
  folderPath: string;
  nextCursor: string;
}

export type ItemData = AssetData | FolderData | LoadMoreData | Record<string, unknown>;

/**
 * Represents a single item in the Cloudinary Tree View.
 */
class CloudinaryItem extends vscode.TreeItem {
  public type: CloudinaryItemType;
  public data: ItemData;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    type: CloudinaryItemType,
    data: ItemData,
    cloudName?: string,
    dynamicFolders = false
  ) {
    const isAsset = type === 'asset';
    const labelToDisplay =
      isAsset && dynamicFolders && 'display_name' in data
        ? data.display_name || (data.public_id?.split('/').pop() ?? label)
        : label;

    // Truncate the label if it's too long, but keep the full name in tooltip
    const truncatedLabel = truncateLabel(labelToDisplay);
    super(truncatedLabel, collapsibleState);
    this.tooltip = labelToDisplay; // Show full name on hover

    this.type = type;
    this.data = data;

    if (type === 'asset' && 'public_id' in data && 'resource_type' in data) {
      const assetType = data.resource_type;

      let optimizedUrl =
        assetType === 'raw'
          ? cloudinary.url(data.public_id, {
            resource_type: 'raw',
            type: data.type,
          })
          : cloudinary.url(data.public_id, {
            resource_type: assetType,
            type: data.type,
            transformation: [
              { fetch_format: assetType === 'video' ? 'auto:video' : 'auto' },
              { quality: 'auto' }
            ],
          });

      data.optimized_url = optimizedUrl;
      data.displayType = assetType;

      // Format file size and type for display
      const fileSize = data.bytes ? formatFileSize(data.bytes) : '';
      const fileType = data.format ? data.format.toUpperCase() : assetType.toUpperCase();
      this.description = `${fileType} • ${fileSize}`;

      this.contextValue = 'asset';
      this.iconPath = new vscode.ThemeIcon(
        assetType === 'video'
          ? 'device-camera-video'
          : assetType === 'raw'
            ? 'file'
            : 'file-media'
      );

      this.command = {
        command: 'cloudinary.openAsset',
        title: 'Open Asset',
        arguments: [data],
      };
    }

    // === FOLDER NODE ===
    else if (type === 'folder') {
      this.contextValue = 'folder';
      this.iconPath = new vscode.ThemeIcon('folder');
    }

    // === LOAD MORE NODE ===
    else if (type === 'loadMore') {
      this.contextValue = 'loadMore';
      this.iconPath = new vscode.ThemeIcon('sync');
      this.command = {
        command: 'cloudinary.loadMoreAssets',
        title: 'Load More',
        arguments: [(data as LoadMoreData).folderPath, (data as LoadMoreData).nextCursor],
      };
    }

    // === DIVIDER NODE ===
    else if (type === 'divider') {
      this.contextValue = undefined;
      this.iconPath = new vscode.ThemeIcon('ellipsis');
      this.tooltip = 'Additional assets loaded';
      this.description = true;
    }
    // === CLEAR SEARCH NODE ===
    else if (type === 'clearSearch') {
      this.contextValue = 'clearSearch';
      this.iconPath = new vscode.ThemeIcon('close');
      this.command = {
        command: 'cloudinary.clearSearch',
        title: 'Clear Search',
      };
    }
  }
}

function truncateLabel(label: string, maxLength: number = 20): string {
  if (label.length <= maxLength) { return label; }
  const extension = label.includes('.') ? label.split('.').pop() : '';
  const nameWithoutExt = extension ? label.slice(0, -(extension.length + 1)) : label;
  const truncatedName = nameWithoutExt.slice(0, maxLength - 3) + '...';
  return extension ? `${truncatedName}.${extension}` : truncatedName;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) { return '0 B'; }
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default CloudinaryItem;