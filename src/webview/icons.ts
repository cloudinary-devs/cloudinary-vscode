/**
 * SVG icons for Cloudinary VS Code extension webviews.
 * Centralized icon definitions to avoid duplication.
 */

/**
 * Icon size presets.
 */
export type IconSize = "sm" | "md" | "lg" | "xl";

const iconSizes: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 48,
};

/**
 * Creates an SVG wrapper with specified size.
 */
function wrapSvg(
  content: string,
  size: IconSize = "md",
  viewBox = "0 0 24 24"
): string {
  const px = iconSizes[size];
  return `<svg width="${px}" height="${px}" viewBox="${viewBox}" fill="currentColor">${content}</svg>`;
}

/**
 * Asset type icons.
 */
export const assetIcons = {
  image: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M6.6751 17.125H17.3501C17.5334 17.125 17.6668 17.05 17.7501 16.9C17.8334 16.75 17.8168 16.6 17.7001 16.45L14.8001 12.55C14.7001 12.4333 14.5834 12.375 14.4501 12.375C14.3168 12.375 14.2001 12.4333 14.1001 12.55L11.1501 16.35L9.1751 13.65C9.0751 13.5333 8.95843 13.475 8.8251 13.475C8.69176 13.475 8.5751 13.5333 8.4751 13.65L6.3501 16.45C6.2501 16.6 6.23343 16.75 6.3001 16.9C6.36676 17.05 6.49176 17.125 6.6751 17.125ZM4.5501 21.15C4.1001 21.15 3.70426 20.9791 3.3626 20.6375C3.02093 20.2958 2.8501 19.9 2.8501 19.45V4.54998C2.8501 4.08331 3.02093 3.68331 3.3626 3.34998C3.70426 3.01664 4.1001 2.84998 4.5501 2.84998H19.4501C19.9168 2.84998 20.3168 3.01664 20.6501 3.34998C20.9834 3.68331 21.1501 4.08331 21.1501 4.54998V19.45C21.1501 19.9 20.9834 20.2958 20.6501 20.6375C20.3168 20.9791 19.9168 21.15 19.4501 21.15H4.5501ZM4.5501 19.45H19.4501V4.54998H4.5501V19.45Z"/>`,
      size
    ),

  video: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M3.5501 3.84998L5.4001 7.64998H8.6501L6.8001 3.84998H9.0251L10.8751 7.64998H14.1251L12.2751 3.84998H14.5001L16.3501 7.64998H19.6001L17.7501 3.84998H20.4501C20.9168 3.84998 21.3168 4.01664 21.6501 4.34998C21.9834 4.68331 22.1501 5.08331 22.1501 5.54998V18.45C22.1501 18.9 21.9834 19.2958 21.6501 19.6375C21.3168 19.9791 20.9168 20.15 20.4501 20.15H3.5501C3.1001 20.15 2.70426 19.9833 2.3626 19.65C2.02093 19.3166 1.8501 18.9166 1.8501 18.45V5.54998C1.8501 5.08331 2.02093 4.68331 2.3626 4.34998C2.70426 4.01664 3.1001 3.84998 3.5501 3.84998ZM3.5501 9.34998V18.45H20.4501V9.34998H3.5501Z"/>`,
      size
    ),

  file: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM9 13H15V15H9V13ZM9 17H15V19H9V17Z"/>`,
      size
    ),

  folder: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>`,
      size
    ),
};

/**
 * Action icons.
 */
export const actionIcons = {
  upload: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>`,
      size
    ),

  download: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>`,
      size
    ),

  copy: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>`,
      size
    ),

  refresh: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>`,
      size
    ),

  search: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>`,
      size
    ),

  close: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>`,
      size
    ),

  enlarge: (size: IconSize = "md") => `
    <svg width="${iconSizes[size]}" height="${iconSizes[size]}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
    </svg>
  `,

  settings: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>`,
      size
    ),

  check: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>`,
      size
    ),

  warning: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>`,
      size
    ),

  info: (size: IconSize = "md") =>
    wrapSvg(
      `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>`,
      size
    ),
};

/**
 * UI element icons.
 */
export const uiIcons = {
  chevronRight: (size: IconSize = "sm") =>
    wrapSvg(
      `<path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>`,
      size
    ),

  chevronDown: (size: IconSize = "sm") =>
    wrapSvg(
      `<path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>`,
      size
    ),

  externalLink: (size: IconSize = "sm") =>
    wrapSvg(
      `<path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>`,
      size
    ),
};

/**
 * Get icon for asset type.
 */
export function getAssetTypeIcon(
  type: "image" | "video" | "raw" | string,
  size: IconSize = "md"
): string {
  switch (type) {
    case "image":
      return assetIcons.image(size);
    case "video":
      return assetIcons.video(size);
    default:
      return assetIcons.file(size);
  }
}

/**
 * All icons exported as a single object for convenience.
 */
export const icons = {
  ...assetIcons,
  ...actionIcons,
  ...uiIcons,
};

export default icons;
