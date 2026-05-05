import { $, browser } from '@wdio/globals';
import wdioUtils from '../utils/wdioUtils.js';
import { WebViewTabBase } from './WebViewTabBase.js';
import allureReporter from '@wdio/allure-reporter';
import { Key } from 'webdriverio'

const HOME_SCREEN_BROWSE_LIBRARY_BUTTON_SELECTOR = '//*[@data-testid="hs-browse-library-button"]';
const SEARCH_INPUT_SELECTOR = '//*[@data-testid="hs-search-input-selector"]';

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

  /**
   * Fills the search input with a value and submits the search.
   * Waits for the input to be displayed (handles view transitions where
   * the homescreen webview needs time to load and reveal the search field).
   */
  public async fillSearchInput(value: string) {
    await allureReporter.addStep(`Fill search input with value '${value}'`);
    await this.switchTo();
    try {
      await wdioUtils.addValue(SEARCH_INPUT_SELECTOR, value);
      await browser.keys(Key.Enter);
    } finally {
      await this.switchBack();
    }
  }
}
