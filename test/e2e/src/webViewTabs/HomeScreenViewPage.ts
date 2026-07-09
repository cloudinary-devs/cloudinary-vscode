import { browser, expect } from '@wdio/globals';
import wdioUtils from '../utils/wdioUtils.js';
import { WebViewTabBase } from './WebViewTabBase.js';
import allureReporter from '@wdio/allure-reporter';
import { Key } from 'webdriverio'

const HOME_SCREEN_BROWSE_LIBRARY_BUTTON_SELECTOR = '//*[@data-testid="hs-browse-library-button"]';
const SEARCH_INPUT_SELECTOR = '//*[@data-testid="hs-search-input-selector"]';
const STATUS_TEXT_SELECTOR = '#hs-status-text';
const CLOUD_NAME_SELECTOR = '#hs-cloud-name';
const FOLDER_MODE_SELECTOR = '#hs-folder-mode';
const SEARCH_CONTAINER_SELECTOR = '#hs-search';
const UPLOAD_BUTTON_SELECTOR = '#hs-btn-upload';
const DOCS_AI_HEADING_SELECTOR = '#hs-docs-ai-heading';
const DOCS_AI_INPUT_SELECTOR = '#hs-docs-ai-input';
const DOCS_AI_SUBMIT_SELECTOR = '#hs-docs-ai-submit';
const DOCS_AI_CHIP_SELECTOR = '.hs-docs-ai-chip';
const AI_TOOLS_BUTTON_SELECTOR = '#hs-btn-ai-tools';
const AI_TOOLS_PANEL_SELECTOR = '#hs-ai-panel';
const AI_TOOLS_READY_STATE_SELECTOR = '#hs-ai-state-ready';
const AI_TOOLS_ERROR_STATE_SELECTOR = '#hs-ai-state-error';
const AI_TOOLS_PLATFORM_SELECT_SELECTOR = '#hs-ai-platform-select';
const AI_TOOLS_SCOPE_BUTTON_SELECTOR = '.hs-ai-scope-btn';
const AI_TOOLS_SKILL_CHECKBOX_SELECTOR = '.hs-ai-cb[data-skill]';
const AI_TOOLS_MCP_CHECKBOX_SELECTOR = '.hs-ai-cb[data-mcp]';
const AI_TOOLS_AVAILABLE_CHECKBOX_SELECTOR = '.hs-ai-cb:not(:disabled)';
const AI_TOOLS_APPLY_BUTTON_SELECTOR = '#hs-ai-apply';

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
   * Waits for the homescreen to show a connected Cloudinary account.
   */
  public async waitForConnected() {
    await allureReporter.addStep('Wait for connected homescreen state');
    await this.switchTo();
    try {
      let latestStatus = '';
      let latestCloudName = '';
      await browser.waitUntil(async () => {
        const status = await browser.$(STATUS_TEXT_SELECTOR);
        const cloudName = await browser.$(CLOUD_NAME_SELECTOR);
        const folderMode = await browser.$(FOLDER_MODE_SELECTOR);
        const search = await browser.$(SEARCH_CONTAINER_SELECTOR);

        if (!(await status.isExisting()) || !(await cloudName.isExisting())) {
          return false;
        }

        latestStatus = (await status.getText()).trim();
        latestCloudName = (await cloudName.getText()).trim();
        return latestStatus === 'Connected'
          && latestCloudName.length > 0
          && latestCloudName !== 'Not configured'
          && await folderMode.isDisplayed()
          && await search.isDisplayed();
      }, {
        timeout: 20000,
        timeoutMsg: `Timed out waiting for connected homescreen state. Latest status: "${latestStatus}", cloud: "${latestCloudName}"`,
      });

      expect(latestStatus).toBe('Connected');
      expect(latestCloudName).not.toBe('Not configured');
    } finally {
      await this.switchBack();
    }
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

  /**
   * Clicks the Upload button.
   */
  public async clickUploadButton() {
    await allureReporter.addStep('Click Upload button');
    await this.switchTo();
    try {
      await wdioUtils.click(UPLOAD_BUTTON_SELECTOR);
    } finally {
      await this.switchBack();
    }
  }

  /**
   * Validates that the Docs AI launcher UI is ready on the homescreen.
   */
  public async validateDocsAiLauncherReady() {
    await allureReporter.addStep('Validate Docs AI launcher is ready');
    await this.switchTo();
    try {
      const heading = await browser.$(DOCS_AI_HEADING_SELECTOR);
      await heading.waitForDisplayed();
      expect(await heading.getText()).toBe('Ask Cloudinary AI');

      const input = await browser.$(DOCS_AI_INPUT_SELECTOR);
      await input.waitForDisplayed();

      const submit = await browser.$(DOCS_AI_SUBMIT_SELECTOR);
      await submit.waitForExist();
      expect(await submit.isEnabled()).toBe(false);

      const chips = await browser.$$(DOCS_AI_CHIP_SELECTOR);
      expect(chips.length).toBeGreaterThanOrEqual(4);
    } finally {
      await this.switchBack();
    }
  }

  /**
   * Validates that entering a Docs AI prompt enables the submit control.
   */
  public async validateDocsAiPromptEnablesSubmit(prompt: string) {
    await allureReporter.addStep(`Validate Docs AI prompt enables submit: '${prompt}'`);
    await this.switchTo();
    try {
      const input = await browser.$(DOCS_AI_INPUT_SELECTOR);
      await input.waitForDisplayed();
      await input.setValue(prompt);

      const submit = await browser.$(DOCS_AI_SUBMIT_SELECTOR);
      await browser.waitUntil(async () => submit.isEnabled(), {
        timeout: 5000,
        timeoutMsg: 'Docs AI submit button did not enable after entering a prompt',
      });
      expect(await submit.isEnabled()).toBe(true);
    } finally {
      await this.switchBack();
    }
  }

  /**
   * Validates that the AI tools accordion can hydrate host data and selection state.
   */
  public async validateAiToolsPanelReadyAndSelectionEnablesApply() {
    await allureReporter.addStep('Validate AI tools panel loads and selection enables Apply');
    await this.switchTo();
    try {
      const button = await browser.$(AI_TOOLS_BUTTON_SELECTOR);
      await button.waitForClickable();
      await button.click();

      const panel = await browser.$(AI_TOOLS_PANEL_SELECTOR);
      await panel.waitForDisplayed();
      await browser.waitUntil(async () => {
        const errorState = await browser.$(AI_TOOLS_ERROR_STATE_SELECTOR);
        if (await errorState.isExisting()) {
          const errorClass = await errorState.getAttribute('class');
          if (!errorClass.includes('hidden')) {
            throw new Error(`AI tools panel failed to load: ${(await errorState.getText()).trim()}`);
          }
        }

        const readyState = await browser.$(AI_TOOLS_READY_STATE_SELECTOR);
        if (!(await readyState.isExisting())) {
          return false;
        }
        const readyClass = await readyState.getAttribute('class');
        return !readyClass.includes('hidden');
      }, {
        timeout: 30000,
        timeoutMsg: 'Timed out waiting for AI tools panel data',
      });

      expect(await button.getAttribute('aria-expanded')).toBe('true');

      const platformSelect = await browser.$(AI_TOOLS_PLATFORM_SELECT_SELECTOR);
      await platformSelect.waitForDisplayed();
      const platformOptions = await browser.$$(`${AI_TOOLS_PLATFORM_SELECT_SELECTOR} option`);
      expect(platformOptions.length).toBeGreaterThan(1);

      const scopeButtons = await browser.$$(AI_TOOLS_SCOPE_BUTTON_SELECTOR);
      expect(scopeButtons.length).toBe(2);

      const skillRows = await browser.$$(AI_TOOLS_SKILL_CHECKBOX_SELECTOR);
      expect(skillRows.length).toBeGreaterThan(0);
      const mcpRows = await browser.$$(AI_TOOLS_MCP_CHECKBOX_SELECTOR);
      expect(mcpRows.length).toBeGreaterThan(0);

      const applyButton = await browser.$(AI_TOOLS_APPLY_BUTTON_SELECTOR);
      await applyButton.waitForDisplayed();
      expect(await applyButton.isEnabled()).toBe(false);

      const availableCheckbox = await browser.$(AI_TOOLS_AVAILABLE_CHECKBOX_SELECTOR);
      await availableCheckbox.waitForExist();
      await availableCheckbox.scrollIntoView();
      await availableCheckbox.click();

      await browser.waitUntil(async () => applyButton.isEnabled(), {
        timeout: 5000,
        timeoutMsg: 'AI tools Apply button did not enable after selecting an available item',
      });
      expect(await applyButton.isEnabled()).toBe(true);
    } finally {
      await this.switchBack();
    }
  }
}
