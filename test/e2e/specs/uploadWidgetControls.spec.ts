import { activityBarUtils } from '../src/vscodeComponentsUtils/ActivityBarUtils.js';
import { sideBarViewUtils } from '../src/vscodeComponentsUtils/SideBarViewUtils.js';
import { uploadToCloudinaryTab } from '../src/webViewTabs/UploadToCloudinaryTab.js';

describe('Upload widget controls', () => {
    it('should open from the homescreen with folder and preset controls ready', async () => {
        await activityBarUtils.openView('Cloudinary');

        await sideBarViewUtils.homeScreenViewPage.waitForConnected();
        await sideBarViewUtils.homeScreenViewPage.clickUploadButton();

        await uploadToCloudinaryTab.switchTo();
        await uploadToCloudinaryTab.validateUploadControlsReady();
        await uploadToCloudinaryTab.waitForFolderOptionsLoaded();
        await uploadToCloudinaryTab.validateRootFolderOption();
        await uploadToCloudinaryTab.switchBack();
    });
});
