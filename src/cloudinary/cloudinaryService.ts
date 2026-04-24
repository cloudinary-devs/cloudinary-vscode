import {
  ChildrenPage,
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

  /** Placeholder methods — implemented in subsequent tasks. */
  async fetchChildren(_folderPath: string, _opts: FetchChildrenOpts): Promise<ChildrenPage> {
    throw new Error('Not implemented');
  }
}
