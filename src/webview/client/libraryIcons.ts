const ICON_SIZE = 14;

function icon(body: string): string {
  return `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

function filled(body: string, extra = ''): string {
  return `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"${extra ? ` ${extra}` : ''}>${body}</svg>`;
}

export const rowIcons = {
  chevron: () =>
    `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>`,

  folder: () =>
    icon(
      '<path d="M3 6.25a1.25 1.25 0 0 1 1.25-1.25h3.6a1 1 0 0 1 .78.37l1.2 1.5a1 1 0 0 0 .78.38h5.14A1.25 1.25 0 0 1 17 8.5v7.25A1.25 1.25 0 0 1 15.75 17H4.25A1.25 1.25 0 0 1 3 15.75V6.25z"/>'
    ),

  folderOpen: () =>
    filled(
      '<path d="M3 6.25a1.25 1.25 0 0 1 1.25-1.25h3.6a1 1 0 0 1 .78.37l1.2 1.5a1 1 0 0 0 .78.38h5.14A1.25 1.25 0 0 1 17 8.5v.5H3V6.25z"/><path d="M3.1 10h13.8l-1.06 5.55A1.5 1.5 0 0 1 14.37 17H4.63a1.5 1.5 0 0 1-1.47-1.45L3.1 10z" opacity="0.85"/>'
    ),

  image: () =>
    `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><circle cx="7" cy="8" r="1.3" fill="currentColor"/><path d="M3 14.5l4.3-4 3.2 2.6 2.5-2 4.5 3.9"/></svg>`,

  video: () =>
    `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 20 20" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9zm5.5 2.2v4.6l4-2.3-4-2.3z"/></svg>`,

  file: () =>
    `<svg width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M5.5 2.5h5.3l3.7 3.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-7.5A1.5 1.5 0 0 1 4 16V4a1.5 1.5 0 0 1 1.5-1.5zm5 0v3.7h3.7"/></svg>`,

  close: () =>
    `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>`,

  lock: () =>
    `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="7" width="9" height="6.5" rx="1.2"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>`,
};

export function assetIcon(resourceType: 'image' | 'video' | 'raw'): string {
  if (resourceType === 'video') {
    return rowIcons.video();
  }
  if (resourceType === 'raw') {
    return rowIcons.file();
  }
  return rowIcons.image();
}

export function folderIcon(expanded: boolean): string {
  return expanded ? rowIcons.folderOpen() : rowIcons.folder();
}

const MENU_ICON_SIZE = 14;

function menuSvg(body: string, viewBox = '0 0 24 24'): string {
  return `<svg width="${MENU_ICON_SIZE}" height="${MENU_ICON_SIZE}" viewBox="${viewBox}" fill="currentColor" aria-hidden="true">${body}</svg>`;
}

export const menuIcons = {
  link: () =>
    menuSvg(
      '<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>'
    ),

  hash: () =>
    menuSvg(
      '<path d="M20 7h-4l1-4h-2l-1 4h-4l1-4h-2L8 7H4v2h3.5L6.5 13H3v2h3l-1 4h2l1-4h4l-1 4h2l1-4h4v-2h-3.5l1-4H20V7zm-5.5 6h-4l1-4h4l-1 4z"/>'
    ),

  bolt: () =>
    menuSvg('<path d="M7 2v11h3v9l7-12h-4l4-8z"/>'),

  upload: () =>
    menuSvg('<path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>'),
};
