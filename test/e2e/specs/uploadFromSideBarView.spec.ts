import path from "path";
import { CloudinarySDK } from "../src/sdks/cloudinarySDK.js";
import { pathUtils } from "../src/utils/pathUtils.js";
import { SideBarViewActions, sideBarViewUtils } from "../src/vscodeComponentsUtils/SideBarViewUtils.js";
import { activityBarUtils } from "../src/vscodeComponentsUtils/ActivityBarUtils.js";
import { uploadToCloudinaryTab } from "../src/webViewTabs/UploadToCloudinaryTab.js";
import * as fs from 'node:fs';
import { expect } from "@wdio/globals";
import allureReporter from '@wdio/allure-reporter'

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
            throw new Error('Error copying asset:', error);
        }
    });

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([firstAssetPublicID]);
        } catch (error) {
            throw new Error('Error deleting assets:', error);
        }
    });

    it('should upload an asset using the side bar Upload button with custom public ID', async () => {
        await activityBarUtils.openView('Cloudinary');
        await sideBarViewUtils.homeScreenViewPage.clickBrowseLibraryButton();
        
        await sideBarViewUtils.clickAction(SideBarViewActions.UPLOAD);

        await uploadToCloudinaryTab.switchTo();
        await uploadToCloudinaryTab.openAdvancedOptions();
        await uploadToCloudinaryTab.fillCustomPublicId(firstAssetPublicID);
        
        await uploadToCloudinaryTab.uploadLocalFile(newFilePath);

        await uploadToCloudinaryTab.switchBack();

        await activityBarUtils.openView('Cloudinary');
        
        await sideBarViewUtils.clickAction(SideBarViewActions.REFRESH);

        await sideBarViewUtils.validateContentItemsExist([newFileName.replace('.png', '')]);

        await allureReporter.addStep('Validate that the asset was uploaded with the correct display name');
        const byPublicId = await cloudinarySDK.V2.api.resource(firstAssetPublicID);
        expect(byPublicId.display_name).toBe(newFileName.replace('.png', ''));
    });
});

