import * as vscode from 'vscode';
import { v2 as cloudinary } from 'cloudinary';
import CloudinaryItem from './cloudinaryItem';
import { handleCloudinaryError } from '../utils/cloudinaryErrorHandler';
import { isPlaceholderConfig } from '../config/configUtils';

export class CloudinaryTreeDataProvider implements vscode.TreeDataProvider<CloudinaryItem> {
  // Cloudinary credentials
  apiKey: string | null = null;
  apiSecret: string | null = null;
  cloudName: string | null = null;
  uploadPreset: string | null = null;
  uploadPresets: Array<{
    name: string;
    signed: boolean;
    settings?: {}
  }> = [];

  dynamicFolders = false;

  private viewState = {
    folderPath: '',
    nextCursor: null as string | null,
    searchQuery: null as string | null,
    isPaginating: false,
    resourceTypeFilter: 'all' as 'image' | 'video' | 'raw' | 'all',
  };

  private assetMap: Map<string, CloudinaryItem[]> = new Map();

  private _onDidChangeTreeData = new vscode.EventEmitter<CloudinaryItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /**
   * Refreshes the tree data view.
   */
  refresh(stateUpdate: Partial<typeof this.viewState> = {}, append = false) {
    this.viewState = {
      ...this.viewState,
      ...stateUpdate,
      isPaginating: !!stateUpdate.nextCursor,
    };

    if (!append && !this.viewState.isPaginating) {
      this.assetMap.clear();
    }

    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CloudinaryItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: CloudinaryItem): Promise<CloudinaryItem[]> {
    if (!this.apiKey || !this.apiSecret || !this.cloudName) {
      return [];
    }

    // Prevent API calls with placeholder credentials
    if (isPlaceholderConfig(this.cloudName, this.apiKey, this.apiSecret)) {
      return [];
    }

    if (!element) {
      if (this.viewState.searchQuery) {
        const results = await this.searchAssets(this.viewState.searchQuery);
        const clear = new CloudinaryItem("Clear Search", vscode.TreeItemCollapsibleState.None, "clearSearch", {});
        return [clear, ...results];
      }
      return this.assetMap.get('') || await this.fetchFoldersAndAssets('');
    }

    if (element.type === 'folder' && 'path' in element.data) {
      const folderPath = element.data.path || '';
      return this.assetMap.get(folderPath) || await this.fetchFoldersAndAssets(folderPath);
    }

    return [];
  }

  async fetchFoldersAndAssets(
    folderPath = '',
    nextCursor: string | null = null,
    append = false
  ): Promise<CloudinaryItem[]> {
    try {
      const maxResults = 100;
      const expression = folderPath ? `folder="${folderPath}"` : '';

      const folderPromise = cloudinary.api.sub_folders(folderPath);
      const assetQuery = cloudinary.search
        .expression(expression)
        .sort_by('created_at', 'desc')
        .max_results(maxResults)
        .with_field(["tags", "context", "metadata"]);

      if (nextCursor) { assetQuery.next_cursor(nextCursor); }

      const [foldersResult, assetsResult] = await Promise.all([
        folderPromise,
        assetQuery.execute(),
      ]);

      const folders = (foldersResult.folders || []).map(
        (folder: any) =>
          new CloudinaryItem(
            folder.name,
            vscode.TreeItemCollapsibleState.Collapsed,
            'folder',
            folder,
            this.cloudName!,
            this.dynamicFolders
          )
      );

      const filteredAssets = assetsResult.resources.filter((asset: any) => {
        const isRootLoad = folderPath === '' && !this.dynamicFolders;
        const isNestedAsset = asset.public_id.includes('/');
        if (isRootLoad && isNestedAsset) { return false; }
        if (this.viewState.resourceTypeFilter === 'all') { return true; }
        return asset.resource_type?.toLowerCase() === this.viewState.resourceTypeFilter;
      });

      const newAssets = filteredAssets.map(
        (asset: any) =>
          new CloudinaryItem(
            asset.public_id,
            vscode.TreeItemCollapsibleState.None,
            'asset',
            asset,
            this.cloudName!,
            this.dynamicFolders
          )
      );

      if (!append) {
        this.assetMap.set(folderPath, [...folders, ...newAssets]);
      } else {
        const existing = this.assetMap.get(folderPath) || [];
        this.assetMap.set(folderPath, [...existing, ...newAssets]);
      }

      if (assetsResult.next_cursor) {
        this.viewState.nextCursor = assetsResult.next_cursor;
        const loadMoreItem = new CloudinaryItem(
          'Load More...',
          vscode.TreeItemCollapsibleState.None,
          'loadMore',
          {
            folderPath,
            nextCursor: assetsResult.next_cursor,
          }
        );
        const updatedList = this.assetMap.get(folderPath) || [];
        this.assetMap.set(folderPath, [...updatedList, loadMoreItem]);
      } else {
        this.viewState.nextCursor = null;
      }

      return this.assetMap.get(folderPath) || [];
    } catch (err: any) {
      handleCloudinaryError('Failed to fetch folders or assets', err);
      return [];
    }
  }

  async searchAssets(query: string, nextCursor: string | null = null): Promise<CloudinaryItem[]> {
    try {
      const maxResults = 100;
      const searchQuery = cloudinary.search
        .expression(`${query}*`)
        .sort_by('public_id', 'asc')
        .max_results(maxResults);

      if (nextCursor) { searchQuery.next_cursor(nextCursor); }

      const assetsResult = await searchQuery.execute();

      const assets = assetsResult.resources.map(
        (asset: any) =>
          new CloudinaryItem(
            asset.public_id,
            vscode.TreeItemCollapsibleState.None,
            'asset',
            asset,
            this.cloudName!,
            this.dynamicFolders
          )
      );

      if (assetsResult.next_cursor) {
        assets.push(
          new CloudinaryItem(
            'Load More...',
            vscode.TreeItemCollapsibleState.None,
            'loadMore',
            {
              searchQuery: query,
              nextCursor: assetsResult.next_cursor,
            }
          )
        );
      }

      return assets;
    } catch (err: any) {
      handleCloudinaryError('Search failed', err);
      return [];
    }
  }

  /**
   * Fetches available upload presets from Cloudinary.
   * @returns Array of upload presets with their names and signed status.
   */
  async fetchUploadPresets(): Promise<Array<{
    name: string;
    signed: boolean;
    settings?: {}
  }>> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Cloudinary credentials not configured');
    }

    try {
      const result = await cloudinary.api.upload_presets({ max_results: 500 });
      this.uploadPresets = result.presets.map((preset: any) => ({
        name: preset.name,
        signed: preset.unsigned === false,
        settings: preset.settings
      }));
      return this.uploadPresets;
    } catch (err: any) {
      handleCloudinaryError('Failed to fetch upload presets', err);
      return [];
    }
  }

  /**
   * Gets the currently selected upload preset or the first available one.
   * @returns The selected upload preset name or null if none available.
   */
  getCurrentUploadPreset(): string | null {
    if (this.uploadPreset && this.uploadPresets.some(p => p.name === this.uploadPreset)) {
      return this.uploadPreset;
    }
    return this.uploadPresets.length > 0 ? this.uploadPresets[0].name : null;
  }

  public updateLoadMoreItem(folderPath: string, nextCursor: string) {
    const items = this.assetMap.get(folderPath);
    if (!items) { return; }

    const index = items.findIndex(
      (item) =>
        item.type === "loadMore" &&
        item.data.folderPath === folderPath &&
        item.data.nextCursor === nextCursor
    );

    if (index !== -1) {
      const updated = [...items];
      updated.splice(
        index,
        1,
        new CloudinaryItem(
          "──── More assets loaded ────",
          vscode.TreeItemCollapsibleState.None,
          "divider",
          {}
        )
      );
      this.assetMap.set(folderPath, updated);
      this._onDidChangeTreeData.fire(); // optional, if you want immediate refresh
    }
  }
}
