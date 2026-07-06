import path from 'node:path';
import crypto from 'node:crypto';
import { CloudinarySDK } from '../src/sdks/cloudinarySDK.js';
import { activityBarUtils } from '../src/vscodeComponentsUtils/ActivityBarUtils.js';
import { sideBarViewUtils } from '../src/vscodeComponentsUtils/SideBarViewUtils.js';
import { pathUtils } from '../src/utils/pathUtils.js';
import { createHookError } from '../src/utils/errorUtils.js';
import { libraryViewPage } from '../src/webViewTabs/LibraryViewPage.js';

describe('Homescreen interactions', () => {
    const cloudinarySDK = new CloudinarySDK();
    const assetPublicID = `e2e-home-${crypto.randomUUID().substring(0, 8)}`;

    beforeEach(async () => {
        try {
            await cloudinarySDK.V2.uploader.upload(
                path.join(pathUtils.getTestAssetsPath(), 'sample_png.png'),
                { public_id: assetPublicID }
            );
        } catch (error) {
            throw createHookError('Error uploading homescreen search asset', error);
        }
    });

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([assetPublicID]);
        } catch (error) {
            throw createHookError('Error deleting homescreen search asset', error);
        }
    });

    it('should show connected controls and search the library from the homescreen', async () => {
        await activityBarUtils.openView('Cloudinary');

        await sideBarViewUtils.homeScreenViewPage.waitForConnected();
        await sideBarViewUtils.homeScreenViewPage.validateDocsAiLauncherReady();
        await sideBarViewUtils.homeScreenViewPage.validateDocsAiPromptEnablesSubmit('How do I upload images?');
        await sideBarViewUtils.homeScreenViewPage.validateAiToolsPanelReadyAndSelectionEnablesApply();
        await sideBarViewUtils.homeScreenViewPage.fillSearchInput(assetPublicID);

        await libraryViewPage.waitForLoaded();
        await libraryViewPage.validateSearchInputValue(assetPublicID);
        await libraryViewPage.validateAssetsExist([assetPublicID]);
        await libraryViewPage.validateVisibleAssetCount(1);
    });
});
