import * as assert from 'assert';
import { CloudinaryService, CloudinarySdkAdapter } from '../../cloudinary/cloudinaryService';
import { ClientAsset } from '../../cloudinary/types';

function fakeAdapter(overrides: Partial<CloudinarySdkAdapter> = {}): CloudinarySdkAdapter {
  return {
    subFolders: async () => ({ folders: [] }),
    search: async () => ({ resources: [], next_cursor: null }),
    uploadPresets: async () => ({ presets: [] }),
    urlFor: (publicId, opts) => {
      const tx = Array.isArray(opts.transformation) ? (opts.transformation as any[]) : [];
      const flat = Object.assign({}, ...tx);
      const parts: string[] = [];
      if (flat.width) { parts.push(`w_${flat.width}`); }
      if (flat.height) { parts.push(`h_${flat.height}`); }
      if (flat.crop) { parts.push(`c_${flat.crop}`); }
      if (flat.fetch_format) { parts.push(`f_${flat.fetch_format}`); }
      if (flat.quality) { parts.push(`q_${flat.quality}`); }
      const tail = parts.length ? `/${parts.join(',')}` : '';
      return `https://res.cloudinary.com/demo/${opts.resource_type}/upload${tail}/${publicId}`;
    },
    ...overrides,
  };
}

suite('CloudinaryService', () => {
  test('constructs without credentials', () => {
    const svc = new CloudinaryService(fakeAdapter());
    assert.strictEqual(svc.cloudName, null);
    assert.strictEqual(svc.dynamicFolders, false);
  });

  test('setCredentials stores values', () => {
    const svc = new CloudinaryService(fakeAdapter());
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    assert.strictEqual(svc.cloudName, 'demo');
    assert.strictEqual(svc.dynamicFolders, true);
  });

  test('setCredentials defaults uploadPreset to null when omitted', () => {
    const svc = new CloudinaryService(fakeAdapter());
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's' });
    assert.strictEqual(svc.uploadPreset, null);
    assert.strictEqual(svc.dynamicFolders, false);
  });
});

suite('CloudinaryService.fetchChildren', () => {
  test('returns folders and assets for root with dynamic folders', async () => {
    const adapter = fakeAdapter({
      subFolders: async (path) => {
        assert.strictEqual(path, '');
        return { folders: [{ name: 'photos', path: 'photos' }] };
      },
      search: async (opts) => {
        assert.strictEqual(opts.expression, 'asset_folder=""');
        return {
          resources: [{
            public_id: 'sample',
            resource_type: 'image',
            type: 'upload',
            bytes: 1024,
            secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
          }],
          next_cursor: null,
        };
      },
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const page = await svc.fetchChildren('', { resourceTypeFilter: 'all', sortDirection: 'desc' });
    assert.strictEqual(page.folders.length, 1);
    assert.strictEqual(page.folders[0].name, 'photos');
    assert.strictEqual(page.assets.length, 1);
    assert.strictEqual(page.assets[0].public_id, 'sample');
    assert.ok(page.assets[0].optimized_url.startsWith('https://'));
    assert.ok(page.assets[0].optimized_url.includes('f_auto'), 'optimized_url should include f_auto');
    assert.ok(page.assets[0].optimized_url.includes('q_auto'), 'optimized_url should include q_auto');
    assert.ok(page.assets[0].thumbnail_url.includes('w_160'));
    assert.strictEqual(page.nextCursor, null);
  });

  test('filters out nested assets at root in fixed folder mode', async () => {
    const adapter = fakeAdapter({
      subFolders: async () => ({ folders: [] }),
      search: async () => ({
        resources: [
          { public_id: 'root', resource_type: 'image', type: 'upload', secure_url: 'x' },
          { public_id: 'foo/bar', resource_type: 'image', type: 'upload', secure_url: 'x' },
        ],
        next_cursor: null,
      }),
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: false });
    const page = await svc.fetchChildren('', { resourceTypeFilter: 'all', sortDirection: 'desc' });
    assert.strictEqual(page.assets.length, 1);
    assert.strictEqual(page.assets[0].public_id, 'root');
  });

  test('respects resourceTypeFilter', async () => {
    const adapter = fakeAdapter({
      search: async () => ({
        resources: [
          { public_id: 'a', resource_type: 'image', type: 'upload', secure_url: 'x' },
          { public_id: 'b', resource_type: 'video', type: 'upload', secure_url: 'x' },
        ],
        next_cursor: null,
      }),
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const page = await svc.fetchChildren('', { resourceTypeFilter: 'image', sortDirection: 'desc' });
    assert.strictEqual(page.assets.length, 1);
    assert.strictEqual(page.assets[0].public_id, 'a');
  });

  test('raw asset: thumbnail_url equals optimized_url', async () => {
    const adapter = fakeAdapter({
      search: async () => ({
        resources: [
          { public_id: 'doc.pdf', resource_type: 'raw', type: 'upload', secure_url: 'x' },
        ],
        next_cursor: null,
      }),
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const page = await svc.fetchChildren('', { resourceTypeFilter: 'all', sortDirection: 'desc' });
    assert.strictEqual(page.assets.length, 1);
    assert.strictEqual(page.assets[0].thumbnail_url, page.assets[0].optimized_url);
  });

  test('propagates nextCursor into the search call', async () => {
    let seenCursor: string | undefined;
    const adapter = fakeAdapter({
      search: async (opts) => {
        seenCursor = opts.nextCursor;
        return { resources: [], next_cursor: null };
      },
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    await svc.fetchChildren('', { resourceTypeFilter: 'all', sortDirection: 'desc', nextCursor: 'abc123' });
    assert.strictEqual(seenCursor, 'abc123');
  });

  test('fixed folder mode at non-root uses folder="path" expression', async () => {
    let seenExpr: string | undefined;
    const adapter = fakeAdapter({
      subFolders: async () => ({ folders: [] }),
      search: async (opts) => {
        seenExpr = opts.expression;
        return { resources: [], next_cursor: null };
      },
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: false });
    await svc.fetchChildren('photos/2024', { resourceTypeFilter: 'all', sortDirection: 'desc' });
    assert.strictEqual(seenExpr, 'folder="photos/2024"');
  });
});

suite('CloudinaryService.prefetchRemaining', () => {
  test('streams batches and stops when cursor is null', async () => {
    let call = 0;
    const adapter = fakeAdapter({
      search: async () => {
        call++;
        if (call === 1) {
          return { resources: [{ public_id: 'a', resource_type: 'image', type: 'upload', secure_url: 'x' }], next_cursor: 'c2' };
        }
        return { resources: [{ public_id: 'b', resource_type: 'image', type: 'upload', secure_url: 'x' }], next_cursor: null };
      },
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const batches: Array<{ assets: ClientAsset[]; hasMore: boolean }> = [];
    await svc.prefetchRemaining('', 'c1', { resourceTypeFilter: 'all', sortDirection: 'desc' }, (assets, hasMore) => {
      batches.push({ assets, hasMore });
    });
    assert.strictEqual(batches.length, 2);
    assert.strictEqual(batches[0].hasMore, true);
    assert.strictEqual(batches[1].hasMore, false);
  });

  test('cap-terminated stream reports hasMore=false on final batch', async () => {
    const adapter = fakeAdapter({
      search: async () => ({
        resources: [
          { public_id: 'a', resource_type: 'image', type: 'upload', secure_url: 'x' },
          { public_id: 'b', resource_type: 'image', type: 'upload', secure_url: 'x' },
        ],
        next_cursor: 'alive',
      }),
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const batches: Array<{ hasMore: boolean; count: number }> = [];
    await svc.prefetchRemaining(
      '',
      'c1',
      { resourceTypeFilter: 'all', sortDirection: 'desc' },
      (assets, hasMore) => batches.push({ hasMore, count: assets.length }),
      2, // cap
    );
    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].count, 2);
    assert.strictEqual(batches[0].hasMore, false, 'cap-terminated stream must report hasMore=false');
  });

  test('empty filtered batch does not invoke onBatch and still terminates', async () => {
    let call = 0;
    const adapter = fakeAdapter({
      search: async () => {
        call++;
        if (call === 1) {
          // All resources filtered out: fixed-folder root + nested public_ids.
          return {
            resources: [
              { public_id: 'foo/a', resource_type: 'image', type: 'upload', secure_url: 'x' },
              { public_id: 'foo/b', resource_type: 'image', type: 'upload', secure_url: 'x' },
            ],
            next_cursor: 'alive',
          };
        }
        return { resources: [], next_cursor: null };
      },
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: false });
    const batches: Array<{ count: number; hasMore: boolean }> = [];
    await svc.prefetchRemaining(
      '',
      'c1',
      { resourceTypeFilter: 'all', sortDirection: 'desc' },
      (assets, hasMore) => batches.push({ count: assets.length, hasMore }),
    );
    assert.strictEqual(batches.length, 0, 'no batches should be delivered when all resources filter out');
  });
});
