export interface ClientAsset {
  public_id: string;
  display_name?: string;
  resource_type: 'image' | 'video' | 'raw';
  type?: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  secure_url: string;
  optimized_url: string;
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

export type ResourceTypeFilter = 'all' | 'image' | 'video' | 'raw';
export type SortDirection = 'asc' | 'desc';

export type InboundMessage =
  | { command: 'rootData'; folders: ClientFolder[]; assets: ClientAsset[]; hasMore: boolean }
  | { command: 'folderData'; path: string; folders: ClientFolder[]; assets: ClientAsset[]; hasMore: boolean }
  | { command: 'assetsAppended'; path: string; assets: ClientAsset[]; hasMore: boolean }
  | { command: 'searchData'; query: string; assets: ClientAsset[]; hasMore: boolean }
  | { command: 'searchAppended'; assets: ClientAsset[]; hasMore: boolean }
  | { command: 'envChanged'; cloudName: string; folderMode: 'dynamic' | 'fixed'; hasConfig: boolean }
  | {
      command: 'viewStateChanged';
      resourceTypeFilter: ResourceTypeFilter;
      sortDirection: SortDirection;
    }
  | { command: 'error'; message: string }
  | { command: 'focusSearch' };

export type OutboundMessage =
  | { command: 'ready' }
  | { command: 'expandFolder'; path: string }
  | { command: 'openAsset'; asset: ClientAsset }
  | {
      command: 'contextAction';
      action: 'copyUrl' | 'copyPublicId' | 'copyOptimizedUrl' | 'uploadToFolder';
      data: ClientAsset | ClientFolder;
    }
  | {
      command: 'runToolbar';
      action: 'refresh' | 'openUploadWidget' | 'showHomescreen' | 'openGlobalConfig';
    }
  | { command: 'setView'; resourceTypeFilter: ResourceTypeFilter; sortDirection: SortDirection }
  | { command: 'searchAssets'; query: string }
  | { command: 'clearSearch' };
