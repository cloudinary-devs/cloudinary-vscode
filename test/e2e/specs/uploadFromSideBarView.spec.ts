import path from "path";
import { CloudinarySDK } from "../src/sdks/cloudinarySDK.js";
import { pathUtils } from "../src/utils/pathUtils.js";
import { sideBarViewUtils } from "../src/vscodeComponentsUtils/SideBarViewUtils.js";
import { activityBarUtils } from "../src/vscodeComponentsUtils/ActivityBarUtils.js";
import { uploadToCloudinaryTab } from "../src/webViewTabs/UploadToCloudinaryTab.js";
import * as fs from 'node:fs';
import { expect } from "@wdio/globals";
import allureReporter from '@wdio/allure-reporter'
import { createHookError } from "../src/utils/errorUtils.js";
import { libraryViewPage } from "../src/webViewTabs/LibraryViewPage.js";

describe('Upload asset from side bar Upload button', () => {

    const cloudinarySDK = new CloudinarySDK();
    const assetPath = path.join(pathUtils.getTestAssetsPath(), 'sample_png.png');

    const newFileName = `${crypto.randomUUID().substring(0, 8)}.png`;
    const newFilePath = path.join(pathUtils.getTempFolderPath(), newFileName);

    const firstAssetPublicID = `e2e-test-ae-${crypto.randomUUID().substring(0, 8)}`;

    beforeEach(async () => {
        try {
            // Copy with a unique name so the sidebar shows the display name (not the public ID) in dynamic folder environments
            fs.copyFileSync(assetPath, newFilePath);
        } catch (error) {
            throw createHookError('Error copying asset', error);
        }
    });

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([firstAssetPublicID]);
        } catch (error) {
            throw createHookError('Error deleting assets', error);
        }
    });

    it('should upload an asset using the side bar Upload button with custom public ID', async () => {
        await activityBarUtils.openView('Cloudinary');
        await sideBarViewUtils.homeScreenViewPage.clickBrowseLibraryButton();

        await libraryViewPage.waitForLoaded();
        await libraryViewPage.clickToolbarAction('openUploadWidget');

        await uploadToCloudinaryTab.switchTo();
        await uploadToCloudinaryTab.openAdvancedOptions();
        await uploadToCloudinaryTab.fillCustomPublicId(firstAssetPublicID);

        await uploadToCloudinaryTab.uploadLocalFile(newFilePath);

        await uploadToCloudinaryTab.switchBack();

        await activityBarUtils.openView('Cloudinary');

        await cloudinarySDK.waitUntilAssetIsUploaded(firstAssetPublicID);

        await libraryViewPage.clickToolbarAction('refresh');

        await libraryViewPage.validateAssetsExist([firstAssetPublicID]);

        await allureReporter.addStep('Validate that the asset was uploaded with the correct display name');
        const byPublicId = await cloudinarySDK.V2.api.resource(firstAssetPublicID);
        expect(byPublicId.display_name).toBe(newFileName.replace('.png', ''));
    });
});
