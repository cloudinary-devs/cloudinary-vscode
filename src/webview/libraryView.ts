import * as vscode from 'vscode';
import { isPlaceholderConfig } from '../config/configUtils';
import { CloudinaryService } from '../cloudinary/cloudinaryService';
import {
  ChildrenPage,
  ClientAsset,
  ResourceTypeFilter,
  SortDirection,
} from '../cloudinary/types';
import { handleCloudinaryError } from '../utils/cloudinaryErrorHandler';
import {
  createWebviewDocument,
  getScriptUri,
  getStyleUri,
} from './webviewUtils';
import { actionIcons } from './icons';

export class LibraryWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'cloudinaryMediaLibrary';

  private _view: vscode.WebviewView | undefined;
  private _viewState = {
    folderPath: '',
    searchQuery: null as string | null,
    resourceTypeFilter: 'all' as ResourceTypeFilter,
    sortDirection: 'desc' as SortDirection,
  };
  private _cache = new Map<string, ChildrenPage>();
  private _prefetchingFolders = new Set<string>();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _service: CloudinaryService,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this._view = view;
    view.onDidDispose(() => {
      this._view = undefined;
    });

    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'media'),
        vscode.Uri.joinPath(this._extensionUri, 'resources'),
      ],
    };

    const scriptUri = getScriptUri(view.webview, this._extensionUri, 'library.js');
    const cssUri = getStyleUri(view.webview, this._extensionUri, 'library.css');
    const logoUri = view.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'resources', 'cloudinary_icon_blue.png')
    );

    const sel = (current: string, value: string): string =>
      current === value ? ' selected' : '';
    const rt = this._viewState.resourceTypeFilter;
    const sd = this._viewState.sortDirection;

    view.webview.html = createWebviewDocument({
      title: 'Cloudinary Media Library',
      webview: view.webview,
      extensionUri: this._extensionUri,
      bodyContent: `
        <header class="lib-header">
          <div class="lib-brand">
            <span class="lib-brand__logo-wrap" aria-hidden="true">
              <img class="lib-brand__logo" src="${logoUri}" alt="" />
            </span>
            <span class="lib-brand__name">Cloudinary</span>
            <span class="lib-brand__env" id="lib-env" aria-label="Active cloud"></span>
          </div>
          <div id="lib-toolbar" class="lib-toolbar" role="toolbar" aria-label="Library actions">
            <div class="lib-tb-group">
              <button class="lib-tb-btn" data-action="showHomescreen" title="Home" aria-label="Home">${actionIcons.home('sm')}</button>
              <button class="lib-tb-btn" data-action="refresh" title="Refresh" aria-label="Refresh">${actionIcons.refresh('sm')}</button>
            </div>
            <div class="lib-tb-group">
              <button class="lib-tb-btn" data-action="openUploadWidget" title="Upload" aria-label="Upload">${actionIcons.upload('sm')}</button>
            </div>
            <div class="lib-tb-group lib-tb-group--utility">
              <button class="lib-tb-btn" data-action="openGlobalConfig" title="Configuration" aria-label="Configuration">${actionIcons.settings('sm')}</button>
            </div>
          </div>
          <div id="lib-filter" class="lib-filter" role="group" aria-label="Filter and sort">
            <label class="lib-filter__group">
              <span class="lib-filter__label">Type</span>
              <select id="lib-filter-type" class="lib-filter__select" aria-label="Filter by resource type">
                <option value="all"${sel(rt, 'all')}>All</option>
                <option value="image"${sel(rt, 'image')}>Images</option>
                <option value="video"${sel(rt, 'video')}>Videos</option>
                <option value="raw"${sel(rt, 'raw')}>Raw</option>
              </select>
            </label>
            <label class="lib-filter__group">
              <span class="lib-filter__label">Sort</span>
              <select id="lib-filter-sort" class="lib-filter__select" aria-label="Sort direction">
                <option value="desc"${sel(sd, 'desc')}>Newest</option>
                <option value="asc"${sel(sd, 'asc')}>Oldest</option>
              </select>
            </label>
          </div>
          <div id="lib-search" class="lib-search" role="search" aria-label="Search media library">
            <div class="lib-search__wrap">
              <svg class="lib-search__icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"/>
              </svg>
              <input
                id="lib-search-input"
                class="lib-search__input"
                type="text"
                placeholder="Search library…"
                autocomplete="off"
                spellcheck="false"
                aria-label="Search media library"
              />
              <button id="lib-search-clear" class="lib-search__clear hidden" title="Clear search" aria-label="Clear search">✕</button>
            </div>
          </div>
        </header>
        <div id="lib-root" class="lib-root" role="tree" aria-label="Media library"></div>
      `,
      additionalStyles: [cssUri],
      additionalScripts: [scriptUri],
    });

    view.webview.onDidReceiveMessage((message) => {
      void this.handleMessage(message);
    });
  }

  private async handleMessage(message: any): Promise<void> {
    switch (message?.command) {
      case 'ready':
        this.post({
          command: 'envChanged',
          cloudName: this._service.cloudName || '',
          folderMode: this._service.dynamicFolders ? 'dynamic' : 'fixed',
          hasConfig: this.hasCredentials(),
        });
        await this.refreshCurrentView();
        return;
      case 'expandFolder':
        await this.sendFolder(String(message.path || ''));
        return;
      case 'openAsset':
        if (message.asset) {
          const asset = message.asset as ClientAsset;
          const filename =
            asset.display_name ||
            asset.public_id.split('/').pop() ||
            asset.public_id;
          void vscode.commands.executeCommand('cloudinary.openAsset', {
            ...asset,
            displayType: asset.resource_type,
            filename,
          });
        }
        return;
      case 'runToolbar': {
        const action = String(message.action || '');
        const commandMap: Record<string, string> = {
          refresh: 'cloudinary.refresh',
          openUploadWidget: 'cloudinary.openUploadWidget',
          showHomescreen: 'cloudinary.showHomescreen',
          openGlobalConfig: 'cloudinary.openGlobalConfig',
        };
        const command = commandMap[action];
        if (command) {
          void vscode.commands.executeCommand(command);
        }
        return;
      }
      case 'contextAction': {
        const action = String(message.action || '');
        if (
          action === 'copyUrl' ||
          action === 'copyPublicId' ||
          action === 'copyOptimizedUrl'
        ) {
          void vscode.commands.executeCommand(`cloudinary.${action}`, {
            data: message.data,
          });
        } else if (action === 'uploadToFolder') {
          void vscode.commands.executeCommand('cloudinary.uploadToFolder', {
            label: message.data?.name || '',
            data: message.data,
          });
        }
        return;
      }
      case 'clearSearch':
        await this.setSearch(null);
        return;
      case 'searchAssets': {
        const query = typeof message.query === 'string' ? message.query : '';
        await this.setSearch(query);
        return;
      }
      case 'setView': {
        await this.applyView({
          resourceTypeFilter: message.resourceTypeFilter,
          sortDirection: message.sortDirection,
        });
        return;
      }
      default:
        return;
    }
  }

  async setSearch(query: string | null): Promise<void> {
    this._viewState.searchQuery = query && query.trim().length > 0
      ? query.trim()
      : null;
    try {
      await this.refreshCurrentView();
    } catch (err: any) {
      handleCloudinaryError('Failed to search library', err);
      this.post({
        command: 'error',
        message: err?.message || 'Failed to search library',
      });
    }
  }

  async applyView(opts: {
    resourceTypeFilter?: ResourceTypeFilter;
    sortDirection?: SortDirection;
  }): Promise<void> {
    if (opts.resourceTypeFilter) {
      this._viewState.resourceTypeFilter = opts.resourceTypeFilter;
    }
    if (opts.sortDirection) {
      this._viewState.sortDirection = opts.sortDirection;
    }

    this._cache.clear();
    this.post({
      command: 'viewStateChanged',
      resourceTypeFilter: this._viewState.resourceTypeFilter,
      sortDirection: this._viewState.sortDirection,
    });

    try {
      await this.refreshCurrentView();
    } catch (err: any) {
      handleCloudinaryError('Failed to apply library view options', err);
      this.post({
        command: 'error',
        message: err?.message || 'Failed to refresh library view',
      });
    }
  }

  async refresh(): Promise<void> {
    this._cache.clear();
    try {
      await this.refreshCurrentView();
    } catch (err: any) {
      handleCloudinaryError('Failed to refresh library', err);
      this.post({
        command: 'error',
        message: err?.message || 'Failed to refresh library',
      });
    }
  }

  async envChanged(): Promise<void> {
    this._cache.clear();
    this._viewState = {
      folderPath: '',
      searchQuery: null,
      resourceTypeFilter: 'all',
      sortDirection: 'desc',
    };
    this.post({
      command: 'envChanged',
      cloudName: this._service.cloudName || '',
      folderMode: this._service.dynamicFolders ? 'dynamic' : 'fixed',
      hasConfig: this.hasCredentials(),
    });
    this.post({
      command: 'viewStateChanged',
      resourceTypeFilter: this._viewState.resourceTypeFilter,
      sortDirection: this._viewState.sortDirection,
    });
    await this.sendRoot();
  }

  private async sendRoot(): Promise<void> {
    if (!this.hasCredentials()) {
      return;
    }

    const page = await this.loadFolder('');
    this.post({
      command: 'rootData',
      folders: page.folders,
      assets: page.assets,
      hasMore: !!page.nextCursor,
    });

    if (page.nextCursor) {
      this.startPrefetch('', page.nextCursor);
    }
  }

  private async sendSearch(query: string): Promise<void> {
    if (!this.hasCredentials()) {
      return;
    }

    try {
      const result = await this._service.searchAssets(query, {
        resourceTypeFilter: this._viewState.resourceTypeFilter,
        sortDirection: this._viewState.sortDirection,
      });

      this.post({
        command: 'searchData',
        query,
        assets: result.assets,
        hasMore: !!result.nextCursor,
      });

      if (result.nextCursor) {
        this.startSearchPrefetch(query, result.nextCursor);
      }
    } catch (err: any) {
      handleCloudinaryError('Failed to search library', err);
      this.post({
        command: 'error',
        message: err?.message || 'Failed to search library',
      });
    }
  }

  private async sendFolder(path: string): Promise<void> {
    if (!this.hasCredentials()) {
      return;
    }

    const page = await this.loadFolder(path);
    this.post({
      command: 'folderData',
      path,
      folders: page.folders,
      assets: page.assets,
      hasMore: !!page.nextCursor,
    });

    if (page.nextCursor) {
      this.startPrefetch(path, page.nextCursor);
    }
  }

  private hasCredentials(): boolean {
    const service = this._service;
    if (!service.cloudName || !service.apiKey || !service.apiSecret) {
      return false;
    }

    if (isPlaceholderConfig(service.cloudName, service.apiKey, service.apiSecret)) {
      return false;
    }

    return true;
  }

  private async loadFolder(path: string): Promise<ChildrenPage> {
    const cached = this._cache.get(path);
    if (cached) {
      return cached;
    }

    try {
      const page = await this._service.fetchChildren(path, {
        resourceTypeFilter: this._viewState.resourceTypeFilter,
        sortDirection: this._viewState.sortDirection,
      });
      this._cache.set(path, page);
      return page;
    } catch (err: any) {
      handleCloudinaryError('Failed to fetch folders or assets', err);
      this.post({
        command: 'error',
        message: err?.message || 'Failed to load library',
      });
      return { folders: [], assets: [], nextCursor: null };
    }
  }

  private async refreshCurrentView(): Promise<void> {
    if (this._viewState.searchQuery) {
      await this.sendSearch(this._viewState.searchQuery);
      return;
    }

    await this.sendRoot();
  }

  private startPrefetch(path: string, startCursor: string): void {
    if (this._prefetchingFolders.has(path)) {
      return;
    }

    this._prefetchingFolders.add(path);

    this._service.prefetchRemaining(
      path,
      startCursor,
      {
        resourceTypeFilter: this._viewState.resourceTypeFilter,
        sortDirection: this._viewState.sortDirection,
      },
      (assets, hasMore) => {
        const entry = this._cache.get(path);
        if (entry) {
          entry.assets = entry.assets.concat(assets);
          entry.nextCursor = hasMore ? entry.nextCursor : null;
        }

        this.post({ command: 'assetsAppended', path, assets, hasMore });
      }
    )
      .catch((err) => {
        console.error('Prefetch error:', err);
      })
      .finally(() => {
        this._prefetchingFolders.delete(path);
      });
  }

  private startSearchPrefetch(query: string, startCursor: string): void {
    const key = `search:${query}`;
    if (this._prefetchingFolders.has(key)) {
      return;
    }

    this._prefetchingFolders.add(key);

    this._service.prefetchSearchResults(
      query,
      startCursor,
      {
        resourceTypeFilter: this._viewState.resourceTypeFilter,
        sortDirection: this._viewState.sortDirection,
      },
      (assets, hasMore) => {
        this.post({ command: 'searchAppended', assets, hasMore });
      }
    )
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        this._prefetchingFolders.delete(key);
      });
  }

  private post(message: unknown): void {
    const view = this._view;
    if (!view) {
      return;
    }
    try {
      view.webview.postMessage(message);
    } catch {
      // Webview disposed between checks; safe to drop.
    }
  }
}
