/**
 * Webview UI components - public exports.
 * 
 * This module exports all UI components for building consistent webviews
 * in the Cloudinary VS Code extension.
 */

// Button components
export {
  getButtonStyles,
  createButton,
  createIconButton,
  createButtonGroup,
  type ButtonOptions,
  type IconButtonOptions,
} from "./button";

// Card/Panel components
export {
  getCardStyles,
  createCard,
  createPanel,
  createSection,
  createDivider,
  type CardOptions,
  type PanelOptions,
} from "./card";

// Tab components
export {
  getTabStyles,
  getTabScript,
  createTabs,
  type Tab,
  type TabsOptions,
} from "./tabs";

// Input/Select components
export {
  getInputStyles,
  createInput,
  createSelect,
  createFormGroup,
  createSettingsRow,
  createSettingCard,
  type InputOptions,
  type SelectOptions,
  type SelectOption,
  type FormGroupOptions,
} from "./input";

// Progress bar components
export {
  getProgressBarStyles,
  createProgressBar,
  createQueueItem,
  createUploadQueue,
  type ProgressBarOptions,
  type QueueItemOptions,
} from "./progressBar";

// Info row components
export {
  getInfoRowStyles,
  createInfoRow,
  createUrlItem,
  createInfoList,
  createKeyValueGrid,
  type InfoRowOptions,
  type UrlItemOptions,
} from "./infoRow";

// Badge/Tag components
export {
  getBadgeStyles,
  createBadge,
  createTag,
  createTagList,
  createStatusIndicator,
  type BadgeOptions,
  type TagOptions,
  type StatusIndicatorOptions,
} from "./badge";

// Drop zone components
export {
  getDropZoneStyles,
  getDropZoneScript,
  createDropZone,
  createAssetCard,
  createUploadedAssetsSection,
  uploadIcon,
  fileIcon,
  type DropZoneOptions,
} from "./dropZone";

// Lightbox/Modal components
export {
  getLightboxStyles,
  getLightboxScript,
  createLightbox,
  createModal,
  createPreviewContainer,
  createCollapsible,
  enlargeIcon,
  closeIcon,
  type LightboxOptions,
  type ModalOptions,
} from "./lightbox";

// Layout components
export { getLayoutComponentStyles } from "./layout";

// Import style functions for the combined exports
import { getButtonStyles } from "./button";
import { getCardStyles } from "./card";
import { getTabStyles, getTabScript } from "./tabs";
import { getInputStyles } from "./input";
import { getProgressBarStyles } from "./progressBar";
import { getInfoRowStyles } from "./infoRow";
import { getBadgeStyles } from "./badge";
import { getDropZoneStyles, getDropZoneScript } from "./dropZone";
import { getLightboxStyles, getLightboxScript } from "./lightbox";
import { getLayoutComponentStyles } from "./layout";

/**
 * Returns all component CSS styles combined.
 * Use this when you need all component styles in a single stylesheet.
 */
export function getAllComponentStyles(): string {
  return [
    getButtonStyles(),
    getCardStyles(),
    getTabStyles(),
    getInputStyles(),
    getProgressBarStyles(),
    getInfoRowStyles(),
    getBadgeStyles(),
    getDropZoneStyles(),
    getLightboxStyles(),
    getLayoutComponentStyles(),
  ].join("\n");
}

/**
 * Returns all component JavaScript combined.
 * Use this when you need all component scripts in a single block.
 */
export function getAllComponentScripts(): string {
  return [
    getTabScript(),
    getDropZoneScript(),
    getLightboxScript(),
  ].join("\n");
}
