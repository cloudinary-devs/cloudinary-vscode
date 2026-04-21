/**
 * Shared utility functions for Cloudinary VS Code extension webviews.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Use this for any user-provided or dynamic content inserted into HTML.
 *
 * @param str - String to escape
 * @returns Escaped string safe for HTML insertion
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Formats a byte count into a human-readable string.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "2.4 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Truncates a string to a maximum length with ellipsis.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @param position - Where to place ellipsis: 'end', 'middle', or 'start'
 * @returns Truncated string
 */
export function truncateString(
  str: string,
  maxLength: number,
  position: "end" | "middle" | "start" = "end"
): string {
  if (str.length <= maxLength) {
    return str;
  }

  switch (position) {
    case "start":
      return "..." + str.slice(-(maxLength - 3));
    case "middle": {
      const half = Math.floor((maxLength - 3) / 2);
      return str.slice(0, half) + "..." + str.slice(-half);
    }
    case "end":
    default:
      return str.slice(0, maxLength - 3) + "...";
  }
}

/**
 * Generates a unique ID for elements.
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique ID string
 */
export function generateId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates an HTML attribute string from an object.
 *
 * @param attrs - Object with attribute name-value pairs
 * @returns Attribute string for HTML element
 */
export function buildAttributes(attrs: Record<string, string | boolean | undefined>): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => {
      if (value === true) {
        return key;
      }
      return `${key}="${escapeHtml(String(value))}"`;
    })
    .join(" ");
}

/**
 * Client-side helper functions (returned as a string to be included in webview scripts).
 */
export function getHelperScript(): string {
  return `
    /**
     * Generate a unique ID
     */
    function generateId(prefix = 'id') {
      return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Truncate string with ellipsis
     */
    function truncateString(str, maxLength, position = 'end') {
      if (str.length <= maxLength) return str;
      
      switch (position) {
        case 'start':
          return '...' + str.slice(-(maxLength - 3));
        case 'middle':
          const half = Math.floor((maxLength - 3) / 2);
          return str.slice(0, half) + '...' + str.slice(-half);
        case 'end':
        default:
          return str.slice(0, maxLength - 3) + '...';
      }
    }

    /**
     * Format bytes to human readable size
     */
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
  `;
}
