import path from "path";
import { CloudinarySDK } from "../src/sdks/cloudinarySDK.js";
import { pathUtils } from "../src/utils/pathUtils.js";
import { SideBarViewActions, sideBarViewUtils } from "../src/vscodeComponentsUtils/SideBarViewUtils.js";
import { activityBarUtils } from "../src/vscodeComponentsUtils/ActivityBarUtils.js";
import { uploadToCloudinaryTab } from "../src/webViewTabs/UploadToCloudinaryTab.js";

describe('Upload asset from side bar Upload button', () => {

    const cloudinarySDK = new CloudinarySDK();
    const filePath = path.join(pathUtils.getTestAssetsPath(), 'sample_png.png');
    const firstAssetPublicID = `e2e-test-ae-${crypto.randomUUID().substring(0, 8)}`;

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([firstAssetPublicID]);
        } catch (error) {
            throw new Error('Error deleting assets:', error);
        }
    });

    it('should upload an asset using the side bar Upload button with custom public ID', async () => {
        await activityBarUtils.openView('Cloudinary');
        await sideBarViewUtils.clickAction(SideBarViewActions.UPLOAD);

        await uploadToCloudinaryTab.open();
        await uploadToCloudinaryTab.openAdvancedOptions();
        await uploadToCloudinaryTab.fillCustomPublicId(firstAssetPublicID);
        
        await uploadToCloudinaryTab.uploadLocalFile(filePath);

        await uploadToCloudinaryTab.close();

        await activityBarUtils.openView('Cloudinary');
        await sideBarViewUtils.clickAction(SideBarViewActions.REFRESH);
        await sideBarViewUtils.validateContentItemsExist([firstAssetPublicID]);
    });
});

