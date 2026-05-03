import path from 'node:path';
import crypto from 'node:crypto';
import { CloudinarySDK } from '../src/sdks/cloudinarySDK.js';
import { activityBarUtils } from '../src/vscodeComponentsUtils/ActivityBarUtils.js';
import { SideBarViewActions, sideBarViewUtils } from '../src/vscodeComponentsUtils/SideBarViewUtils.js';
import { pathUtils } from '../src/utils/pathUtils.js';
import { inputBoxUtils } from '../src/vscodeComponentsUtils/InputBoxUtils.js';
import { browser } from '@wdio/globals';

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
            throw new Error('Error uploading asset:', error);
        }
    });

    afterEach(async () => {
        try {
            await cloudinarySDK.V2.api.delete_resources([assetPublicID]);
        } catch (error) {
            throw new Error('Error deleting asset:', error);
        }
    });

    it('should find the uploaded asset via sidebar search', async () => {
        await activityBarUtils.openView('Cloudinary');

        await sideBarViewUtils.clickAction(SideBarViewActions.SEARCH);

        await inputBoxUtils.fillAndConfirm(assetPublicID);

        await sideBarViewUtils.validateContentItemsExist(['Clear Search', assetPublicID]);
        await sideBarViewUtils.validateContentItemsNumber(2);
    });
});
