import path from 'node:path';
import { CloudinarySDK } from '../src/sdks/cloudinarySDK.js';
import { activityBarUtils } from '../src/vscodeComponentsUtils/ActivityBarUtils.js'
import { sideBarViewUtils } from '../src/vscodeComponentsUtils/SideBarViewUtils.js'
import crypto from 'node:crypto';
import { pathUtils } from '../src/utils/pathUtils.js';

/**
 * Asset Explorer Tests: 
 */
describe('Asset Explorer Tetsts', () => {

    let cloudinarySDK = new CloudinarySDK();
    let firstAssetPublicID = `e2e-test-ae-${crypto.randomUUID().substring(0, 8)}`;
    let secondAssetPublicID = `e2e-test-ae-${crypto.randomUUID().substring(0, 8)}`;

    beforeEach(async () => {
        try {
            await cloudinarySDK.V2.uploader.upload(path.join(pathUtils.getTestAssetsPath(), 'sample_png.png'), { public_id: firstAssetPublicID });
            await cloudinarySDK.V2.uploader.upload(path.join(pathUtils.getTestAssetsPath(), 'sample_png.png'), { public_id: secondAssetPublicID });
        } catch (error) {
            throw new Error('Error uploading assets:', error);
        }
    });

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([firstAssetPublicID, secondAssetPublicID]);
        } catch (error) {
            throw new Error('Error deleting assets:', error);
        }
    });

    /**
     * Validates that the title and content of the Cloudinary media library are loaded correctly.
     */
    it('should load cloudinary media library', async () => {
        const expectedTitle = 'CLOUDINARY';
        const expectedItems = [firstAssetPublicID, secondAssetPublicID];
        
        await activityBarUtils.openView('Cloudinary');
        await sideBarViewUtils.homeScreenViewPage.clickBrowseLibraryButton();

        await sideBarViewUtils.validateSideBarViewTitle(expectedTitle);

        await sideBarViewUtils.validateContentItemsExist(expectedItems);
    });
});

