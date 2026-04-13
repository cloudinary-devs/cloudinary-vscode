import { activityBarUtils } from '../src/utils/ActivityBarUtils.js'
import { sideBarViewUtils } from '../src/utils/SideBarViewUtils.js'

/**
 * Asset Explorer: 
 * Validates that the title and content of the Cloudinary media library are loaded correctly.
 */
it('should load cloudinary media library', async () => {
    const expectedTitle = 'CLOUDINARY';
    const expectedItems = ['samples', 'sample'];
    
    await activityBarUtils.openView('Cloudinary');

    await sideBarViewUtils.validateSideBarViewTitle(expectedTitle);

    await sideBarViewUtils.validateContentItemsExist(expectedItems);
});

