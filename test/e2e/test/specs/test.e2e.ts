import { activityBarUtils } from '../../src/utils/ActivityBarUtils'
import { sideBarViewUtils } from '../../src/utils/SideBarViewUtils'

/**
 * Asset Explorer: 
 * Validates that the title and content of the Cloudinary media library are loaded correctly.
 */
it('should load cloudinary media library', async () => {
    const expectedTitle = 'CLOUDINARY';
    const expectedItems = ['cats', 'dogs'];
    
    await activityBarUtils.openView('Cloudinary');

    await sideBarViewUtils.validateSideBarViewTitle(expectedTitle);

    await sideBarViewUtils.validateContentItemsExist(expectedItems);
});

