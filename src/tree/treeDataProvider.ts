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
    sortDirection: 'desc' as 'asc' | 'desc',
  };

  private assetMap: Map<string, CloudinaryItem[]> = new Map();

  // Track folders currently being prefetched to prevent duplicate requests
  private prefetchingFolders: Set<string> = new Set();

  // Maximum assets to load per folder (to prevent endless fetching for huge folders)
  private readonly MAX_ASSETS_PER_FOLDER = 5000;

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
      const maxResults = 500;

      // Build expression based on folder mode
      // Dynamic folders: use asset_folder field to prevent duplicates
      // Fixed folders: use folder field (or empty for root to get all, then filter)
      let expression: string;
      if (this.dynamicFolders) {
        // Dynamic folders: use asset_folder to only get assets in this specific folder
        expression = folderPath ? `asset_folder="${folderPath}"` : 'asset_folder=""';
      } else {
        // Fixed folders: use folder field (empty returns all, filtered below)
        expression = folderPath ? `folder="${folderPath}"` : '';
      }

      const folderPromise = cloudinary.api.sub_folders(folderPath);
      const assetQuery = cloudinary.search
        .expression(expression)
        .sort_by('created_at', this.viewState.sortDirection)
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
        // For fixed folders at root level, filter out nested assets (they'll appear in their folders)
        if (!this.dynamicFolders && folderPath === '') {
          const isNestedAsset = asset.public_id.includes('/');
          if (isNestedAsset) { return false; }
        }
        // Apply resource type filter
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

      // If there are more assets, start background pre-fetching
      if (assetsResult.next_cursor && !append) {
        this.viewState.nextCursor = assetsResult.next_cursor;

        // Add a loading indicator while prefetching
        const loadingItem = new CloudinaryItem(
          'Loading more assets...',
          vscode.TreeItemCollapsibleState.None,
          'loading',
          { folderPath }
        );
        const currentList = this.assetMap.get(folderPath) || [];
        this.assetMap.set(folderPath, [...currentList, loadingItem]);

        // Start background prefetch (don't await - let it run async)
        this.prefetchRemainingAssets(folderPath, assetsResult.next_cursor);
      } else if (assetsResult.next_cursor && append) {
        // Continue prefetching if this was a prefetch call with more data
        this.viewState.nextCursor = assetsResult.next_cursor;
      } else {
        this.viewState.nextCursor = null;
      }

      return this.assetMap.get(folderPath) || [];
    } catch (err: any) {
      handleCloudinaryError('Failed to fetch folders or assets', err);
      return [];
    }
  }

  /**
   * Background pre-fetches remaining assets for a folder.
   * Runs asynchronously and updates the tree as more assets are loaded.
   */
  private async prefetchRemainingAssets(folderPath: string, initialCursor: string): Promise<void> {
    // Prevent duplicate prefetching for the same folder
    if (this.prefetchingFolders.has(folderPath)) {
      return;
    }
    this.prefetchingFolders.add(folderPath);

    try {
      let nextCursor: string | null = initialCursor;
      let totalAssets = this.countAssetsInFolder(folderPath);

      while (nextCursor && totalAssets < this.MAX_ASSETS_PER_FOLDER) {
        const result = await this.fetchAssetsPage(folderPath, nextCursor);

        if (result.assets.length === 0) {
          break;
        }

        // Remove the loading indicator and append new assets
        this.appendPrefetchedAssets(folderPath, result.assets, result.nextCursor);
        totalAssets += result.assets.length;
        nextCursor = result.nextCursor;

        // Fire tree update to show new assets
        this._onDidChangeTreeData.fire();
      }

      // Remove any remaining loading indicator
      this.removeLoadingIndicator(folderPath);
      this._onDidChangeTreeData.fire();
    } catch (err: any) {
      // Remove loading indicator on error
      this.removeLoadingIndicator(folderPath);
      this._onDidChangeTreeData.fire();
      // Don't show error for background operations - they're non-critical
      console.error('Background prefetch error:', err);
    } finally {
      this.prefetchingFolders.delete(folderPath);
    }
  }

  /**
   * Fetches a single page of assets for prefetching.
   */
  private async fetchAssetsPage(
    folderPath: string,
    cursor: string
  ): Promise<{ assets: CloudinaryItem[]; nextCursor: string | null }> {
    const maxResults = 500;

    let expression: string;
    if (this.dynamicFolders) {
      expression = folderPath ? `asset_folder="${folderPath}"` : 'asset_folder=""';
    } else {
      expression = folderPath ? `folder="${folderPath}"` : '';
    }

    const assetQuery = cloudinary.search
      .expression(expression)
      .sort_by('created_at', this.viewState.sortDirection)
      .max_results(maxResults)
      .with_field(["tags", "context", "metadata"])
      .next_cursor(cursor);

    const assetsResult = await assetQuery.execute();

    const filteredAssets = assetsResult.resources.filter((asset: any) => {
      if (!this.dynamicFolders && folderPath === '') {
        const isNestedAsset = asset.public_id.includes('/');
        if (isNestedAsset) { return false; }
      }
      if (this.viewState.resourceTypeFilter === 'all') { return true; }
      return asset.resource_type?.toLowerCase() === this.viewState.resourceTypeFilter;
    });

    const assets = filteredAssets.map(
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

    return {
      assets,
      nextCursor: assetsResult.next_cursor || null,
    };
  }

  /**
   * Appends prefetched assets to the folder's cache.
   */
  private appendPrefetchedAssets(
    folderPath: string,
    newAssets: CloudinaryItem[],
    hasMore: string | null
  ): void {
    const items = this.assetMap.get(folderPath) || [];

    // Remove the loading indicator if present
    const filteredItems = items.filter(item => item.type !== 'loading');

    // Append new assets
    const updatedItems = [...filteredItems, ...newAssets];

    // Add loading indicator back if there's more to fetch
    if (hasMore) {
      updatedItems.push(
        new CloudinaryItem(
          'Loading more assets...',
          vscode.TreeItemCollapsibleState.None,
          'loading',
          { folderPath }
        )
      );
    }

    this.assetMap.set(folderPath, updatedItems);
  }

  /**
   * Removes the loading indicator from a folder.
   */
  private removeLoadingIndicator(folderPath: string): void {
    const items = this.assetMap.get(folderPath);
    if (!items) { return; }

    const filteredItems = items.filter(item => item.type !== 'loading');
    this.assetMap.set(folderPath, filteredItems);
  }

  /**
   * Counts the number of assets currently loaded for a folder.
   */
  private countAssetsInFolder(folderPath: string): number {
    const items = this.assetMap.get(folderPath) || [];
    return items.filter(item => item.type === 'asset').length;
  }

  // Cache key for search results
  private readonly SEARCH_CACHE_KEY = '__search__';

  async searchAssets(query: string): Promise<CloudinaryItem[]> {
    try {
      const maxResults = 500;
      const searchQuery = cloudinary.search
        .expression(`${query}*`)
        .sort_by('created_at', this.viewState.sortDirection)
        .max_results(maxResults);

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

      // Store in cache
      this.assetMap.set(this.SEARCH_CACHE_KEY, assets);

      // If there are more results, start background pre-fetching
      if (assetsResult.next_cursor) {
        // Add loading indicator
        const loadingItem = new CloudinaryItem(
          'Loading more results...',
          vscode.TreeItemCollapsibleState.None,
          'loading',
          { query }
        );
        this.assetMap.set(this.SEARCH_CACHE_KEY, [...assets, loadingItem]);

        // Start background prefetch
        this.prefetchSearchResults(query, assetsResult.next_cursor);
      }

      return this.assetMap.get(this.SEARCH_CACHE_KEY) || assets;
    } catch (err: any) {
      handleCloudinaryError('Search failed', err);
      return [];
    }
  }

  /**
   * Background pre-fetches remaining search results.
   */
  private async prefetchSearchResults(query: string, initialCursor: string): Promise<void> {
    const prefetchKey = `search:${query}`;

    // Prevent duplicate prefetching
    if (this.prefetchingFolders.has(prefetchKey)) {
      return;
    }
    this.prefetchingFolders.add(prefetchKey);

    try {
      let nextCursor: string | null = initialCursor;
      let totalAssets = this.countSearchResults();

      while (nextCursor && totalAssets < this.MAX_ASSETS_PER_FOLDER) {
        const result = await this.fetchSearchPage(query, nextCursor);

        if (result.assets.length === 0) {
          break;
        }

        // Append new assets to search cache
        this.appendSearchResults(result.assets, result.nextCursor);
        totalAssets += result.assets.length;
        nextCursor = result.nextCursor;

        // Fire tree update
        this._onDidChangeTreeData.fire();
      }

      // Remove loading indicator
      this.removeSearchLoadingIndicator();
      this._onDidChangeTreeData.fire();
    } catch (err: any) {
      this.removeSearchLoadingIndicator();
      this._onDidChangeTreeData.fire();
      console.error('Search prefetch error:', err);
    } finally {
      this.prefetchingFolders.delete(prefetchKey);
    }
  }

  /**
   * Fetches a single page of search results.
   */
  private async fetchSearchPage(
    query: string,
    cursor: string
  ): Promise<{ assets: CloudinaryItem[]; nextCursor: string | null }> {
    const maxResults = 500;

    const searchQuery = cloudinary.search
      .expression(`${query}*`)
      .sort_by('created_at', this.viewState.sortDirection)
      .max_results(maxResults)
      .next_cursor(cursor);

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

    return {
      assets,
      nextCursor: assetsResult.next_cursor || null,
    };
  }

  /**
   * Appends prefetched search results to the cache.
   */
  private appendSearchResults(newAssets: CloudinaryItem[], hasMore: string | null): void {
    const items = this.assetMap.get(this.SEARCH_CACHE_KEY) || [];

    // Remove loading indicator
    const filteredItems = items.filter(item => item.type !== 'loading');

    // Append new assets
    const updatedItems = [...filteredItems, ...newAssets];

    // Add loading indicator back if more to fetch
    if (hasMore) {
      updatedItems.push(
        new CloudinaryItem(
          'Loading more results...',
          vscode.TreeItemCollapsibleState.None,
          'loading',
          {}
        )
      );
    }

    this.assetMap.set(this.SEARCH_CACHE_KEY, updatedItems);
  }

  /**
   * Removes the loading indicator from search results.
   */
  private removeSearchLoadingIndicator(): void {
    const items = this.assetMap.get(this.SEARCH_CACHE_KEY);
    if (!items) { return; }

    const filteredItems = items.filter(item => item.type !== 'loading');
    this.assetMap.set(this.SEARCH_CACHE_KEY, filteredItems);
  }

  /**
   * Counts the number of search results currently loaded.
   */
  private countSearchResults(): number {
    const items = this.assetMap.get(this.SEARCH_CACHE_KEY) || [];
    return items.filter(item => item.type === 'asset').length;
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
   * Gets the currently configured default upload preset.
   * @returns The configured upload preset name, or null if none configured (uses signed upload).
   */
  getCurrentUploadPreset(): string | null {
    // Only return a preset if one is explicitly configured and exists
    if (this.uploadPreset && this.uploadPresets.some(p => p.name === this.uploadPreset)) {
      return this.uploadPreset;
    }
    // Default to null (signed upload) when no preset is configured
    return null;
  }

  /**
   * Gets all folder paths that have been loaded/cached.
   * Returns folder items from the assetMap for use in folder selectors.
   */
  public getAvailableFolders(): Array<{ path: string; name: string }> {
    const folders: Array<{ path: string; name: string }> = [];

    for (const [, items] of this.assetMap.entries()) {
      for (const item of items) {
        if (item.type === 'folder') {
          // FolderData has path and name properties
          const folderData = item.data as { path?: string; name?: string };
          if (folderData.path) {
            folders.push({
              path: folderData.path,
              name: folderData.name || item.label?.toString() || folderData.path,
            });
          }
        }
      }
    }

    // Sort by path for consistent ordering
    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }
}
