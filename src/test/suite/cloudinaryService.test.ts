import * as assert from 'assert';
import { CloudinaryService, CloudinarySdkAdapter } from '../../cloudinary/cloudinaryService';

function fakeAdapter(overrides: Partial<CloudinarySdkAdapter> = {}): CloudinarySdkAdapter {
  return {
    subFolders: async () => ({ folders: [] }),
    search: async () => ({ resources: [], next_cursor: null }),
    uploadPresets: async () => ({ presets: [] }),
    urlFor: (publicId, opts) => `https://res.cloudinary.com/demo/${opts.resource_type}/upload/${publicId}`,
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
