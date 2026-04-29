import {
  ChildrenPage,
  ClientAsset,
  ClientFolder,
  FetchChildrenOpts,
  SortDirection,
  UploadPreset,
} from './types';

/**
 * Narrow view of the Cloudinary SDK used by the service. Injecting this makes
 * the service testable without loading the real SDK.
 */
export interface CloudinarySdkAdapter {
  subFolders(path: string): Promise<{ folders: Array<{ name: string; path: string }> }>;
  search(opts: {
    expression: string;
    sortBy: { field: string; direction: SortDirection };
    maxResults: number;
    nextCursor?: string;
    withField?: string[];
  }): Promise<{ resources: any[]; next_cursor: string | null }>;
  uploadPresets(): Promise<{ presets: Array<{ name: string; unsigned: boolean; settings?: Record<string, unknown> }> }>;
  urlFor(publicId: string, opts: {
    resource_type: string;
    type?: string;
    transformation?: unknown;
    sign_url?: boolean;
    secure?: boolean;
    format?: string;
  }): string;
}

export interface Credentials {
  cloudName: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  uploadPreset?: string | null;
  dynamicFolders?: boolean;
}

/**
 * Pure data layer for the Cloudinary media library.
 * No vscode.* imports. All methods return plain JSON.
 */
export class CloudinaryService {
  cloudName: string | null = null;
  apiKey: string | null = null;
  apiSecret: string | null = null;
  uploadPreset: string | null = null;
  dynamicFolders = false;
  uploadPresets: UploadPreset[] = [];

  constructor(private readonly sdk: CloudinarySdkAdapter) {}

  setCredentials(creds: Credentials): void {
    this.cloudName = creds.cloudName;
    this.apiKey = creds.apiKey;
    this.apiSecret = creds.apiSecret;
    this.uploadPreset = creds.uploadPreset ?? null;
    this.dynamicFolders = creds.dynamicFolders ?? false;
  }

  async fetchChildren(folderPath: string, opts: FetchChildrenOpts): Promise<ChildrenPage> {
    const expression = this.buildExpression(folderPath);
    const [foldersResult, assetsResult] = await Promise.all([
      this.sdk.subFolders(folderPath),
      this.sdk.search({
        expression,
        sortBy: { field: 'created_at', direction: opts.sortDirection },
        maxResults: 500,
        nextCursor: opts.nextCursor,
        withField: ['tags', 'context', 'metadata'],
      }),
    ]);

    const folders: ClientFolder[] = (foldersResult.folders || []).map((f) => ({
      name: f.name,
      path: f.path,
    }));

    const filtered = (assetsResult.resources || []).filter((asset: any) => {
      if (!this.dynamicFolders && folderPath === '' && typeof asset.public_id === 'string' && asset.public_id.includes('/')) {
        return false;
      }
      if (opts.resourceTypeFilter === 'all') { return true; }
      return String(asset.resource_type).toLowerCase() === opts.resourceTypeFilter;
    });

    const assets: ClientAsset[] = filtered.map((a: any) => this.toClientAsset(a));

    return { folders, assets, nextCursor: assetsResult.next_cursor ?? null };
  }

  private buildExpression(folderPath: string): string {
    if (this.dynamicFolders) {
      return folderPath ? `asset_folder="${folderPath}"` : 'asset_folder=""';
    }
    // Fixed-folder root: empty expression returns ALL resources. fetchChildren
    // then filters nested assets client-side. See the `public_id.includes('/')`
    // guard in the resource filter.
    return folderPath ? `folder="${folderPath}"` : '';
  }

  /**
   * Streams remaining pages for a folder via callback. Caller can append to its
   * own cache / forward over postMessage per batch. Stops when cursor is null
   * or `cap` filtered assets have been delivered.
   *
   * NOTE: `cap` counts post-filter assets delivered to `onBatch`, not raw
   * server resources. In fixed-folder-root mode with heavy client-side
   * filtering, the actual API call volume may exceed `cap`.
   */
  async prefetchRemaining(
    folderPath: string,
    startCursor: string,
    opts: FetchChildrenOpts,
    onBatch: (assets: ClientAsset[], hasMore: boolean) => void,
    cap: number = 5000,
  ): Promise<void> {
    let cursor: string | null = startCursor;
    let total = 0;
    const expression = this.buildExpression(folderPath);
    while (cursor && total < cap) {
      const result: { resources: any[]; next_cursor: string | null } = await this.sdk.search({
        expression,
        sortBy: { field: 'created_at', direction: opts.sortDirection },
        maxResults: 500,
        nextCursor: cursor,
        withField: ['tags', 'context', 'metadata'],
      });
      const filtered = (result.resources || []).filter((asset: any) => {
        if (!this.dynamicFolders && folderPath === '' && typeof asset.public_id === 'string' && asset.public_id.includes('/')) {
          return false;
        }
        if (opts.resourceTypeFilter === 'all') { return true; }
        return String(asset.resource_type).toLowerCase() === opts.resourceTypeFilter;
      });
      const assets = filtered.map((a: any) => this.toClientAsset(a));
      cursor = result.next_cursor ?? null;
      if (assets.length === 0) { continue; }
      total += assets.length;
      onBatch(assets, !!cursor && total < cap);
    }
  }

  async searchAssets(query: string, opts: FetchChildrenOpts): Promise<{ assets: ClientAsset[]; nextCursor: string | null }> {
    const result = await this.sdk.search({
      expression: `${query}*`,
      sortBy: { field: 'created_at', direction: opts.sortDirection },
      maxResults: 500,
      withField: ['tags', 'context', 'metadata'],
    });
    const assets = this.filterByResourceType(result.resources || [], opts.resourceTypeFilter)
      .map((a: any) => this.toClientAsset(a));
    return { assets, nextCursor: result.next_cursor ?? null };
  }

  async prefetchSearchResults(
    query: string,
    startCursor: string,
    opts: FetchChildrenOpts,
    onBatch: (assets: ClientAsset[], hasMore: boolean) => void,
    cap: number = 5000,
  ): Promise<void> {
    let cursor: string | null = startCursor;
    let total = 0;
    while (cursor && total < cap) {
      const result: { resources: any[]; next_cursor: string | null } = await this.sdk.search({
        expression: `${query}*`,
        sortBy: { field: 'created_at', direction: opts.sortDirection },
        maxResults: 500,
        nextCursor: cursor,
        withField: ['tags', 'context', 'metadata'],
      });
      const assets = this.filterByResourceType(result.resources || [], opts.resourceTypeFilter)
        .map((a: any) => this.toClientAsset(a));
      cursor = result.next_cursor ?? null;
      if (assets.length === 0) { continue; }
      total += assets.length;
      onBatch(assets, !!cursor && total < cap);
    }
  }

  private filterByResourceType(resources: any[], filter: FetchChildrenOpts['resourceTypeFilter']): any[] {
    return resources.filter((asset: any) => {
      if (filter === 'all') {
        return true;
      }
      return String(asset.resource_type).toLowerCase() === filter;
    });
  }

  private toClientAsset(a: any): ClientAsset {
    // Coerce unexpected resource_type values to 'image'; mirrors prior tree-provider fallback.
    const resourceType = (a.resource_type === 'video' || a.resource_type === 'raw') ? a.resource_type : 'image';
    const deliveryType = typeof a.type === 'string' ? a.type : undefined;
    const isAuthenticated = deliveryType === 'authenticated';
    const baseUrlOpts = {
      resource_type: resourceType,
      type: deliveryType,
      secure: true,
    };

    const signedOriginal = isAuthenticated
      ? this.sdk.urlFor(a.public_id, {
          ...baseUrlOpts,
          sign_url: true,
          ...(resourceType !== 'raw' && a.format ? { format: String(a.format) } : {}),
        })
      : undefined;

    const optimized = signedOriginal || this.sdk.urlFor(a.public_id, {
      ...baseUrlOpts,
      transformation: resourceType === 'raw'
        ? undefined
        : [{ fetch_format: resourceType === 'video' ? 'auto:video' : 'auto' }, { quality: 'auto' }],
    });
    const thumbnail = signedOriginal || (resourceType === 'raw'
      ? optimized
      : this.sdk.urlFor(a.public_id, {
          ...baseUrlOpts,
          transformation: [{ width: 160, height: 160, crop: 'fill', fetch_format: 'auto', quality: 'auto' }],
        }));
    return {
      public_id: a.public_id,
      display_name: a.display_name,
      resource_type: resourceType,
      type: deliveryType,
      format: a.format,
      bytes: a.bytes,
      width: a.width,
      height: a.height,
      secure_url: signedOriginal || a.secure_url,
      optimized_url: optimized,
      thumbnail_url: thumbnail,
      tags: a.tags,
      context: a.context,
      metadata: a.metadata,
      created_at: a.created_at,
    };
  }

  async fetchUploadPresets(): Promise<UploadPreset[]> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error('Cloudinary credentials not configured');
    }
    const result = await this.sdk.uploadPresets();
    this.uploadPresets = result.presets.map((p) => ({
      name: p.name,
      signed: p.unsigned === false,
      settings: p.settings,
    }));
    return this.uploadPresets;
  }

  async listAllFolders(maxDepth = 4): Promise<Array<{ path: string; name: string }>> {
    const all: Array<{ path: string; name: string }> = [];

    const visitLevel = async (paths: string[], depth: number): Promise<void> => {
      if (paths.length === 0 || depth > maxDepth) {
        return;
      }

      const results = await Promise.all(
        paths.map((p) => this.sdk.subFolders(p))
      );

      const next: string[] = [];
      for (const result of results) {
        for (const folder of result.folders || []) {
          all.push({ path: folder.path, name: folder.name });
          next.push(folder.path);
        }
      }

      await visitLevel(next, depth + 1);
    };

    await visitLevel([''], 0);
    return all.sort((a, b) => a.path.localeCompare(b.path));
  }

  getCurrentUploadPreset(): string | null {
    if (this.uploadPreset && this.uploadPresets.some((p) => p.name === this.uploadPreset)) {
      return this.uploadPreset;
    }
    return null;
  }
}
