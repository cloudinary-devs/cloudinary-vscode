import path from 'node:path';
import { CloudinarySDK } from '../src/sdks/cloudinarySDK.js';
import { activityBarUtils } from '../src/utils/ActivityBarUtils.js'
import { sideBarViewUtils } from '../src/utils/SideBarViewUtils.js'
import crypto from 'node:crypto';
import { pathUtils } from '../src/utils/pathUtils.js';


describe('Asset Explorer Tetsts', () => {

    let cloudinarySDK = new CloudinarySDK();
    let assetPublicID = `e2e-test-ae-${crypto.randomUUID().substring(0, 8)}`;

    beforeEach(async () => {
        await cloudinarySDK.V2.uploader.upload(path.join(pathUtils.getTestAssetsPath(), 'sample_png.png'), { public_id: assetPublicID });
    });

    afterEach(async () => {
        await cloudinarySDK.V2.api.delete_resources([assetPublicID]);
    });

    /**
     * Asset Explorer: 
     * Validates that the title and content of the Cloudinary media library are loaded correctly.
     */
    it('should load cloudinary media library', async () => {
        const expectedTitle = 'CLOUDINARY';
        const expectedItems = [assetPublicID];
        
        await activityBarUtils.openView('Cloudinary');

        await sideBarViewUtils.validateSideBarViewTitle(expectedTitle);

        await sideBarViewUtils.validateContentItemsExist(expectedItems);
        });
});

