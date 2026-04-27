/**
 * Plain-JSON asset record passed between service, host bridge, and webview.
 * Intentionally flat and free of vscode.* types so it can be postMessage'd.
 */
export interface ClientAsset {
  public_id: string;
  display_name?: string;
  resource_type: 'image' | 'video' | 'raw';
  /** Cloudinary delivery type: 'upload' | 'authenticated' | 'private' | 'fetch'. */
  type?: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  secure_url: string;
  /** Pre-computed delivery URL with f_auto,q_auto. Authenticated assets use the signed original URL. */
  optimized_url: string;
  /** Pre-computed thumbnail URL. Authenticated assets use the signed original URL instead of dynamic transforms. */
  thumbnail_url: string;
  tags?: string[];
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface ClientFolder {
  name: string;
  path: string;
}

export interface ChildrenPage {
  folders: ClientFolder[];
  assets: ClientAsset[];
  nextCursor: string | null;
}

export type ResourceTypeFilter = 'all' | 'image' | 'video' | 'raw';
export type SortDirection = 'asc' | 'desc';

export interface FetchChildrenOpts {
  resourceTypeFilter: ResourceTypeFilter;
  sortDirection: SortDirection;
  /** Pass a cursor from a previous ChildrenPage. Omit (or pass `undefined`) to start from the beginning. */
  nextCursor?: string;
}

export interface UploadPreset {
  name: string;
  signed: boolean;
  settings?: Record<string, unknown>;
}
