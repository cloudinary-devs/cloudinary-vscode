import path from 'node:path';
import crypto from 'node:crypto';
import { CloudinarySDK } from '../src/sdks/cloudinarySDK.js';
import { activityBarUtils } from '../src/vscodeComponentsUtils/ActivityBarUtils.js';
import { sideBarViewUtils } from '../src/vscodeComponentsUtils/SideBarViewUtils.js';
import { pathUtils } from '../src/utils/pathUtils.js';
import { createHookError } from '../src/utils/errorUtils.js';
import { libraryViewPage } from '../src/webViewTabs/LibraryViewPage.js';
import { assetPreviewTab } from '../src/webViewTabs/AssetPreviewTab.js';

describe('Library filters and preview', () => {
    const cloudinarySDK = new CloudinarySDK();
    const assetPrefix = `e2e-lib-${crypto.randomUUID().substring(0, 8)}`;
    const imagePublicID = `${assetPrefix}-image`;
    const rawPublicID = `${assetPrefix}-raw.txt`;

    beforeEach(async () => {
        try {
            await cloudinarySDK.V2.uploader.upload(
                path.join(pathUtils.getTestAssetsPath(), 'sample_png.png'),
                { public_id: imagePublicID }
            );
            await cloudinarySDK.V2.uploader.upload(
                path.join(pathUtils.getTestAssetsPath(), 'sample_raw.txt'),
                { public_id: rawPublicID, resource_type: 'raw' }
            );
        } catch (error) {
            throw createHookError('Error uploading library filter assets', error);
        }
    });

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([imagePublicID], { resource_type: 'image' });
            await cloudinarySDK.V2.api.delete_resources([rawPublicID], { resource_type: 'raw' });
        } catch (error) {
            throw createHookError('Error deleting library filter assets', error);
        }
    });

    it('should filter searched assets by type and open an asset preview', async () => {
        await activityBarUtils.openView('Cloudinary');
        await sideBarViewUtils.homeScreenViewPage.clickBrowseLibraryButton();

        await libraryViewPage.waitForLoaded();
        await libraryViewPage.fillSearchInput(assetPrefix);
        await libraryViewPage.validateAssetsExist([imagePublicID, rawPublicID]);
        await libraryViewPage.validateVisibleAssetCount(2);

        await libraryViewPage.setSortDirection('asc');
        await libraryViewPage.validateFilterState('all', 'asc');

        await libraryViewPage.setResourceTypeFilter('raw');
        await libraryViewPage.validateFilterState('raw', 'asc');
        await libraryViewPage.validateAssetHasResourceType(rawPublicID, 'raw');
        await libraryViewPage.validateVisibleAssetCount(1);
        await libraryViewPage.validateAssetsNotVisible([imagePublicID]);

        await libraryViewPage.setResourceTypeFilter('image');
        await libraryViewPage.validateFilterState('image', 'asc');
        await libraryViewPage.validateAssetHasResourceType(imagePublicID, 'image');
        await libraryViewPage.validateVisibleAssetCount(1);
        await libraryViewPage.validateAssetsNotVisible([rawPublicID]);

        await libraryViewPage.clickAsset(imagePublicID);
        await assetPreviewTab.switchToAsset(imagePublicID);
        await assetPreviewTab.validateAssetDetails(imagePublicID);
        await assetPreviewTab.switchBack();
    });
});
