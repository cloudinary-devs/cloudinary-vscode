import * as assert from 'assert';
import { uploadWidgetTestApi } from '../../commands/uploadWidget';
import { buildUploadPresetOptions } from '../../webview/client/uploadPresetOptions';

function uploadState(overrides: Record<string, unknown> = {}) {
  return {
    cloudName: 'demo',
    apiKey: 'key',
    apiSecret: 'secret',
    uploadPresets: [],
    dynamicFolders: true,
    fetchUploadPresets: async () => [],
    getCurrentUploadPreset: () => null,
    listAllFolders: async () => [],
    ...overrides,
  } as any;
}

suite('Upload widget folder options', () => {
  teardown(() => {
    uploadWidgetTestApi.clearFolderOptionsCache();
  });

  test('caches successful folder loads for subsequent panel opens', async () => {
    const folders = await uploadWidgetTestApi.collectFolderOptions(uploadState({
      listAllFolders: async () => [
        { path: 'docs', name: 'docs' },
        { path: 'docs/sdk', name: 'sdk' },
      ],
    }));

    assert.deepStrictEqual(
      folders.map((folder) => folder.path),
      ['', 'docs', 'docs/sdk']
    );

    const initialFolders = uploadWidgetTestApi.getInitialFolderOptions('demo');
    assert.deepStrictEqual(
      initialFolders.map((folder) => folder.path),
      ['', 'docs', 'docs/sdk']
    );
  });

  test('keeps cached folders instead of falling back to root after a later fetch failure', async () => {
    await uploadWidgetTestApi.collectFolderOptions(uploadState({
      listAllFolders: async () => [{ path: 'Marketing', name: 'Marketing' }],
    }));

    const folders = await uploadWidgetTestApi.collectFolderOptions(uploadState({
      listAllFolders: async () => {
        throw new Error('temporary timeout');
      },
    }));

    assert.deepStrictEqual(
      folders.map((folder) => folder.path),
      ['', 'Marketing']
    );
  });

  test('does not reuse one cloud folder cache for another cloud', async () => {
    await uploadWidgetTestApi.collectFolderOptions(uploadState({
      cloudName: 'cloudinary',
      listAllFolders: async () => [{ path: 'docs', name: 'docs' }],
    }));

    const folders = await uploadWidgetTestApi.collectFolderOptions(uploadState({
      cloudName: 'demo',
      listAllFolders: async () => {
        throw new Error('unauthorized');
      },
    }));

    assert.deepStrictEqual(
      folders.map((folder) => folder.path),
      ['']
    );
  });
});

suite('Upload widget upload options', () => {
  test('keeps no-preset option when fetched presets refresh the dropdown', () => {
    assert.deepStrictEqual(
      buildUploadPresetOptions([{ name: 'auto-chaptering', signed: true }]),
      [
        { value: '', label: 'No preset (signed upload)' },
        { value: 'auto-chaptering', label: 'auto-chaptering (Signed)' },
      ]
    );
  });

  test('renders no-preset option before fetched presets', () => {
    const html = uploadWidgetTestApi.getUploadContent(
      '',
      [{ name: 'auto-chaptering', signed: true }],
      '',
      [{ path: '', label: '/ (root)' }]
    );

    const noPresetIdx = html.indexOf('No preset (signed upload)');
    const presetIdx = html.indexOf('auto-chaptering (Signed)');

    assert.ok(noPresetIdx >= 0, 'expected upload dropdown to include no-preset option');
    assert.ok(presetIdx >= 0, 'expected upload dropdown to include fetched preset');
    assert.ok(noPresetIdx < presetIdx, 'expected no-preset option to appear first');
  });

  test('omits upload_preset when no preset is selected', () => {
    const options = uploadWidgetTestApi.getUploadOptions(
      uploadState(),
      null,
      '',
    );

    assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'upload_preset'), false);
  });

  test('omits upload_preset for an empty preset value', () => {
    const options = uploadWidgetTestApi.getUploadOptions(
      uploadState(),
      '',
      '',
    );

    assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'upload_preset'), false);
  });

  test('includes upload_preset when a preset is selected', () => {
    const options = uploadWidgetTestApi.getUploadOptions(
      uploadState(),
      'cld-docs',
      '',
    );

    assert.strictEqual(options.upload_preset, 'cld-docs');
  });

  test('uses folder for fixed-folder environments', () => {
    const options = uploadWidgetTestApi.getUploadOptions(
      uploadState({ dynamicFolders: false }),
      null,
      'docs/mediaflows',
    );

    assert.strictEqual(options.folder, 'docs/mediaflows');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'asset_folder'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'use_asset_folder_as_public_id_prefix'), false);
  });

  test('uses asset_folder for dynamic-folder environments without changing the public ID path', () => {
    const options = uploadWidgetTestApi.getUploadOptions(
      uploadState({ dynamicFolders: true }),
      null,
      'docs/mediaflows',
    );

    assert.strictEqual(options.asset_folder, 'docs/mediaflows');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'folder'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'use_asset_folder_as_public_id_prefix'), false);
  });

  test('preserves explicit public IDs in dynamic-folder environments', () => {
    const options = uploadWidgetTestApi.getUploadOptions(
      uploadState({ dynamicFolders: true }),
      null,
      'docs/mediaflows',
      'docs/mediaflows/custom-id',
    );

    assert.strictEqual(options.asset_folder, 'docs/mediaflows');
    assert.strictEqual(options.public_id, 'docs/mediaflows/custom-id');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(options, 'use_asset_folder_as_public_id_prefix'), false);
  });
});
