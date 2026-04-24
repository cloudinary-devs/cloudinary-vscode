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
  urlFor(publicId: string, opts: { resource_type: string; type?: string; transformation?: unknown }): string;
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

  private toClientAsset(a: any): ClientAsset {
    // Coerce unexpected resource_type values to 'image'; mirrors prior tree-provider fallback.
    const resourceType = (a.resource_type === 'video' || a.resource_type === 'raw') ? a.resource_type : 'image';
    const optimized = this.sdk.urlFor(a.public_id, {
      resource_type: resourceType,
      type: a.type,
      transformation: resourceType === 'raw'
        ? undefined
        : [{ fetch_format: resourceType === 'video' ? 'auto:video' : 'auto' }, { quality: 'auto' }],
    });
    const thumbnail = resourceType === 'raw'
      ? optimized
      : this.sdk.urlFor(a.public_id, {
          resource_type: resourceType,
          type: a.type,
          transformation: [{ width: 160, height: 160, crop: 'fill', fetch_format: 'auto', quality: 'auto' }],
        });
    return {
      public_id: a.public_id,
      display_name: a.display_name,
      resource_type: resourceType,
      type: a.type,
      format: a.format,
      bytes: a.bytes,
      width: a.width,
      height: a.height,
      secure_url: a.secure_url,
      optimized_url: optimized,
      thumbnail_url: thumbnail,
      tags: a.tags,
      context: a.context,
      metadata: a.metadata,
      created_at: a.created_at,
    };
  }
}
