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
      const signature = opts.sign_url ? '/s--signed--' : '';
      const format = opts.format ? `.${opts.format}` : '';
      return `https://res.cloudinary.com/demo/${opts.resource_type}/${opts.type || 'upload'}${signature}${tail}/${publicId}${format}`;
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

  test('authenticated asset uses signed original URL for preview fields', async () => {
    const adapter = fakeAdapter({
      search: async () => ({
        resources: [
          {
            public_id: 'secure/sample',
            resource_type: 'image',
            type: 'authenticated',
            format: 'jpg',
            secure_url: 'https://res.cloudinary.com/demo/image/authenticated/secure/sample.jpg',
          },
        ],
        next_cursor: null,
      }),
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const page = await svc.fetchChildren('', { resourceTypeFilter: 'all', sortDirection: 'desc' });
    const asset = page.assets[0];

    assert.strictEqual(asset.type, 'authenticated');
    assert.ok(asset.secure_url.includes('/authenticated/s--signed--/'), 'secure_url should be signed');
    assert.strictEqual(asset.optimized_url, asset.secure_url);
    assert.strictEqual(asset.thumbnail_url, asset.secure_url);
    assert.ok(!asset.secure_url.includes('f_auto'), 'authenticated original URL should not add dynamic transformations');
    assert.ok(asset.secure_url.endsWith('/secure/sample.jpg'));
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

  test('continues after empty filtered batch', async () => {
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
        return {
          resources: [
            { public_id: 'root', resource_type: 'image', type: 'upload', secure_url: 'x' },
          ],
          next_cursor: null,
        };
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
    assert.strictEqual(call, 2);
    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0].count, 1);
    assert.strictEqual(batches[0].hasMore, false);
  });
});

suite('CloudinaryService.searchAssets', () => {
  test('returns results and pages via prefetch', async () => {
    let call = 0;
    const adapter = fakeAdapter({
      search: async (opts) => {
        call++;
        assert.ok(opts.expression.startsWith('foo'));
        if (call === 1) {
          return { resources: [{ public_id: 'foo1', resource_type: 'image', type: 'upload', secure_url: 'x' }], next_cursor: 'c2' };
        }
        return { resources: [{ public_id: 'foo2', resource_type: 'image', type: 'upload', secure_url: 'x' }], next_cursor: null };
      },
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const first = await svc.searchAssets('foo', { resourceTypeFilter: 'all', sortDirection: 'desc' });
    assert.strictEqual(first.assets[0].public_id, 'foo1');
    assert.strictEqual(first.nextCursor, 'c2');

    const batches: ClientAsset[][] = [];
    await svc.prefetchSearchResults('foo', 'c2', { resourceTypeFilter: 'all', sortDirection: 'desc' }, (a) => batches.push(a));
    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0][0].public_id, 'foo2');
  });

  test('applies resourceTypeFilter to search results', async () => {
    const adapter = fakeAdapter({
      search: async () => ({
        resources: [
          { public_id: 'image-1', resource_type: 'image', type: 'upload', secure_url: 'x' },
          { public_id: 'video-1', resource_type: 'video', type: 'upload', secure_url: 'x' },
        ],
        next_cursor: null,
      }),
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const result = await svc.searchAssets('foo', { resourceTypeFilter: 'image', sortDirection: 'desc' });
    assert.strictEqual(result.assets.length, 1);
    assert.strictEqual(result.assets[0].public_id, 'image-1');
  });

  test('prefetchSearchResults continues after empty filtered batch', async () => {
    let call = 0;
    const adapter = fakeAdapter({
      search: async () => {
        call++;
        if (call === 1) {
          return {
            resources: [
              { public_id: 'video-1', resource_type: 'video', type: 'upload', secure_url: 'x' },
            ],
            next_cursor: 'c2',
          };
        }

        return {
          resources: [
            { public_id: 'image-1', resource_type: 'image', type: 'upload', secure_url: 'x' },
          ],
          next_cursor: null,
        };
      },
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', dynamicFolders: true });
    const batches: ClientAsset[][] = [];

    await svc.prefetchSearchResults(
      'foo',
      'c1',
      { resourceTypeFilter: 'image', sortDirection: 'desc' },
      (assets) => batches.push(assets),
    );

    assert.strictEqual(call, 2);
    assert.strictEqual(batches.length, 1);
    assert.strictEqual(batches[0][0].public_id, 'image-1');
  });
});

suite('CloudinaryService.uploadPresets', () => {
  test('fetchUploadPresets stores result', async () => {
    const adapter = fakeAdapter({
      uploadPresets: async () => ({ presets: [
        { name: 'preset1', unsigned: true, settings: { folder: 'x' } },
        { name: 'preset2', unsigned: false },
      ]}),
    });
    const svc = new CloudinaryService(adapter);
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's' });
    const presets = await svc.fetchUploadPresets();
    assert.strictEqual(presets.length, 2);
    assert.strictEqual(presets[0].signed, false);
    assert.strictEqual(presets[1].signed, true);
    assert.strictEqual(svc.uploadPresets.length, 2);
  });

  test('getCurrentUploadPreset returns configured preset when it exists', async () => {
    const svc = new CloudinaryService(fakeAdapter());
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', uploadPreset: 'p1' });
    svc.uploadPresets = [{ name: 'p1', signed: true }];
    assert.strictEqual(svc.getCurrentUploadPreset(), 'p1');
  });

  test('getCurrentUploadPreset returns null when configured preset missing', async () => {
    const svc = new CloudinaryService(fakeAdapter());
    svc.setCredentials({ cloudName: 'demo', apiKey: 'k', apiSecret: 's', uploadPreset: 'ghost' });
    svc.uploadPresets = [{ name: 'p1', signed: true }];
    assert.strictEqual(svc.getCurrentUploadPreset(), null);
  });

  test('fetchUploadPresets throws when credentials missing', async () => {
    const svc = new CloudinaryService(fakeAdapter());
    await assert.rejects(svc.fetchUploadPresets(), /credentials/i);
  });
});
