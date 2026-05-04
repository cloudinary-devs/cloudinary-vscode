import wdioUtils from '../utils/wdioUtils.js';
import { WebViewTabBase } from './WebViewTabBase.js';
import allureReporter from '@wdio/allure-reporter';
const HOME_SCREEN_BROWSE_LIBRARY_BUTTON_SELECTOR = '//*[@data-testid="hs-browse-library-button"]';

/**
 * Page object for the Home Screen View.
 * The home screen is rendered inside a sidebar webview, so all element
 * interactions must happen between switchTo() / switchBack() calls.
 */
export class HomeScreenViewPage extends WebViewTabBase {

  constructor() {
    super('Cloudinary');
  }

  /**
   * Clicks the Browse Library button.
   */
  public async clickBrowseLibraryButton() {
    await allureReporter.addStep('Click Browse Library button');
    await this.switchTo();
    try {
      await wdioUtils.click(HOME_SCREEN_BROWSE_LIBRARY_BUTTON_SELECTOR);
    } finally {
      await this.switchBack();
    }
  }
  
}
