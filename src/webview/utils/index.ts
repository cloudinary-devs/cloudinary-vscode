/**
 * Webview utility scripts - public exports.
 */

export {
  getClipboardScript,
  getInlineClipboardHandler,
} from "./clipboard";

export {
  getMessagingScript,
  getMinimalMessagingScript,
  getCommonMessageHandlers,
} from "./messaging";

export {
  escapeHtml,
  formatFileSize,
  truncateString,
  generateId,
  buildAttributes,
  getHelperScript,
} from "./helpers";
