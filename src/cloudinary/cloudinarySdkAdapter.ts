import { v2 as cloudinary } from 'cloudinary';
import { CloudinarySdkAdapter } from './cloudinaryService';
import { SortDirection } from './types';

/**
 * Production adapter wired to the real Cloudinary SDK.
 */
export function createCloudinarySdkAdapter(): CloudinarySdkAdapter {
  return {
    subFolders: async (path: string) => {
      return cloudinary.api.sub_folders(path) as unknown as {
        folders: Array<{ name: string; path: string }>;
      };
    },
    search: async (opts) => {
      const query = cloudinary.search
        .expression(opts.expression)
        .sort_by(opts.sortBy.field, opts.sortBy.direction as SortDirection)
        .max_results(opts.maxResults);

      if (opts.withField) {
        query.with_field(opts.withField);
      }

      if (opts.nextCursor) {
        query.next_cursor(opts.nextCursor);
      }

      const result = await query.execute();
      return {
        resources: result.resources || [],
        next_cursor: result.next_cursor || null,
      };
    },
    uploadPresets: async () => {
      return cloudinary.api.upload_presets({ max_results: 500 }) as unknown as {
        presets: Array<{
          name: string;
          unsigned: boolean;
          settings?: Record<string, unknown>;
        }>;
      };
    },
    urlFor: (publicId, opts) => cloudinary.url(publicId, opts as any),
  };
}
