import path from 'node:path';
import crypto from 'node:crypto';
import { CloudinarySDK } from '../src/sdks/cloudinarySDK.js';
import { activityBarUtils } from '../src/vscodeComponentsUtils/ActivityBarUtils.js';
import { sideBarViewUtils } from '../src/vscodeComponentsUtils/SideBarViewUtils.js';
import { pathUtils } from '../src/utils/pathUtils.js';
import { createHookError } from '../src/utils/errorUtils.js';
import { libraryViewPage } from '../src/webViewTabs/LibraryViewPage.js';

describe('Search asset from side bar', () => {

    const cloudinarySDK = new CloudinarySDK();
    const assetPublicID = `${crypto.randomUUID().substring(0, 8)}`;

    beforeEach(async () => {
        try {
            await cloudinarySDK.V2.uploader.upload(
                path.join(pathUtils.getTestAssetsPath(), 'sample_png.png'),
                { public_id: assetPublicID }
            );
        } catch (error) {
            throw createHookError('Error uploading asset', error);
        }
    });

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([assetPublicID]);
        } catch (error) {
            throw createHookError('Error deleting asset', error);
        }
    });

    it('should find the uploaded asset via sidebar search', async () => {
        await activityBarUtils.openView('Cloudinary');
        await sideBarViewUtils.homeScreenViewPage.clickBrowseLibraryButton();

        await libraryViewPage.waitForLoaded();
        await libraryViewPage.fillSearchInput(assetPublicID);

        await libraryViewPage.validateAssetsExist([assetPublicID]);
        await libraryViewPage.validateVisibleAssetCount(1);
    });
});
