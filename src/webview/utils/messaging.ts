/**
 * VS Code messaging utility scripts for Cloudinary extension webviews.
 * Handles communication between webview and extension host.
 */

/**
 * Returns JavaScript for VS Code API initialization and messaging.
 */
export function getMessagingScript(): string {
  return `
    /**
     * VS Code API instance (acquired once).
     * @type {ReturnType<typeof acquireVsCodeApi>}
     */
    const vscode = acquireVsCodeApi();

    /**
     * Send a message to the extension host.
     * 
     * @param {string} command - Command identifier
     * @param {Object} data - Additional data to send
     */
    function sendMessage(command, data = {}) {
      vscode.postMessage({
        command: command,
        ...data
      });
    }

    /**
     * Register a handler for messages from the extension.
     * 
     * @param {string} command - Command to handle (or '*' for all)
     * @param {Function} handler - Handler function receiving message data
     * @returns {Function} Unsubscribe function
     */
    function onMessage(command, handler) {
      const listener = (event) => {
        const message = event.data;
        if (command === '*' || message.command === command) {
          handler(message);
        }
      };
      
      window.addEventListener('message', listener);
      
      return () => {
        window.removeEventListener('message', listener);
      };
    }

    /**
     * Message handler registry for organized message handling.
     */
    const messageHandlers = new Map();

    /**
     * Register a message handler.
     * 
     * @param {string} command - Command to handle
     * @param {Function} handler - Handler function
     */
    function registerHandler(command, handler) {
      messageHandlers.set(command, handler);
    }

    /**
     * Process incoming messages through registered handlers.
     */
    window.addEventListener('message', (event) => {
      const message = event.data;
      const handler = messageHandlers.get(message.command);
      if (handler) {
        handler(message);
      }
    });
  `;
}

/**
 * Returns a minimal VS Code API wrapper for basic messaging.
 */
export function getMinimalMessagingScript(): string {
  return `
    const vscode = acquireVsCodeApi();
  `;
}

/**
 * Returns standard message handlers commonly used across webviews.
 */
export function getCommonMessageHandlers(): string {
  return `
    // Handle copyToClipboard response (for fallback)
    registerHandler('copySuccess', (message) => {
      console.log('Copy successful');
    });

    // Handle errors from extension
    registerHandler('error', (message) => {
      console.error('Extension error:', message.error);
    });
  `;
}
