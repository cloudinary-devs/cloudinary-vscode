import { getVSCode, initVSCode } from './common';
import {
  ClientAsset,
  ClientFolder,
  InboundMessage,
} from './libraryTypes';
import { assetIcon, folderIcon, menuIcons, rowIcons } from './libraryIcons';
import { showMenu } from './libraryMenu';
import { spliceOutRangeAtDepth } from './libraryRowSplice';
import { VirtualList } from './libraryVirtualList';

type Row =
  | { kind: 'folder'; folder: ClientFolder; depth: number; expanded: boolean }
  | { kind: 'asset'; asset: ClientAsset; depth: number }
  | { kind: 'loading'; depth: number }
  | { kind: 'clearSearch'; label: string; depth: number };

const ROW_HEIGHT = 22;

let list: VirtualList<Row>;
const flat: Row[] = [];
const childrenByFolder = new Map<string, Row[]>();
let selectedIdx = -1;
let searchMode: { query: string } | null = null;

initVSCode();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rebuild(): void {
  list.setItems(flat.slice());
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes || bytes <= 0) {
    return '';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  const rounded = i === 0 ? Math.round(value) : Number(value.toFixed(1));
  return `${rounded} ${units[i]}`;
}

function isAuthenticatedAsset(asset: ClientAsset): boolean {
  return asset.type === 'authenticated';
}

function getAssetMeta(asset: ClientAsset): string {
  const format = asset.format
    ? asset.format.toUpperCase()
    : asset.resource_type.toUpperCase();
  const size = formatFileSize(asset.bytes);
  const parts = [format];
  if (size) {
    parts.push(size);
  }
  if (isAuthenticatedAsset(asset)) {
    parts.unshift('AUTH');
  }
  return parts.join(' · ');
}


function getRowKey(row: Row | undefined): string | null {
  if (!row) {
    return null;
  }

  switch (row.kind) {
    case 'folder':
      return `folder:${row.folder.path}`;
    case 'asset':
      return `asset:${row.asset.public_id}`;
    case 'clearSearch':
      return 'clearSearch';
    case 'loading':
      return `loading:${row.depth}`;
    default:
      return null;
  }
}

function findRowIdxByKey(key: string | null): number {
  if (!key) {
    return -1;
  }

  return flat.findIndex((row) => getRowKey(row) === key);
}

function showEmptyState(message: string, variant: 'welcome' | 'info' = 'info'): void {
  let empty = document.getElementById('lib-empty') as HTMLDivElement | null;
  if (!empty) {
    empty = document.createElement('div');
    empty.id = 'lib-empty';
    empty.className = 'lib-empty';
    const root = document.getElementById('lib-root');
    if (root?.parentElement) {
      root.parentElement.insertBefore(empty, root);
    }
  }
  empty.classList.toggle('lib-empty--welcome', variant === 'welcome');
  if (variant === 'welcome') {
    empty.innerHTML = `
      <div class="lib-empty__glyph">${rowIcons.folder()}</div>
      <p class="lib-empty__title">${escapeHtml(message)}</p>
      <button class="lib-empty__cta" data-action="openGlobalConfig">Open configuration</button>
    `;
    empty.querySelector<HTMLButtonElement>('.lib-empty__cta')?.addEventListener('click', () => {
      getVSCode()?.postMessage({ command: 'runToolbar', action: 'openGlobalConfig' });
    });
  } else {
    empty.textContent = message;
  }
}

function hideEmptyState(): void {
  document.getElementById('lib-empty')?.remove();
}

function showError(message: string): void {
  let banner = document.getElementById('lib-error') as HTMLDivElement | null;
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'lib-error';
    banner.className = 'lib-error';
    banner.setAttribute('role', 'alert');
    banner.innerHTML =
      '<span class="lib-error__dot" aria-hidden="true"></span>' +
      '<span class="lib-error__msg"></span>' +
      '<button class="lib-error__retry" type="button">Retry</button>';
    const toolbar = document.getElementById('lib-toolbar');
    if (toolbar?.parentElement) {
      toolbar.parentElement.insertBefore(banner, toolbar.nextSibling);
    }
    banner.querySelector('.lib-error__retry')?.addEventListener('click', () => {
      banner?.remove();
      getVSCode()?.postMessage({ command: 'runToolbar', action: 'refresh' });
    });
  }

  const messageEl = banner.querySelector('.lib-error__msg') as HTMLElement | null;
  if (messageEl) {
    messageEl.textContent = message;
  }
}

function clearError(): void {
  document.getElementById('lib-error')?.remove();
}

function snapshotScroll(): { rowKey: string | null; index: number; offsetRatio: number } {
  const container = document.getElementById('lib-root') as HTMLElement | null;
  if (!container) {
    return { rowKey: null, index: 0, offsetRatio: 0 };
  }

  const rowHeight = ROW_HEIGHT;
  const topIdx = Math.floor(container.scrollTop / rowHeight);
  const row = flat[topIdx];
  const offset = container.scrollTop - topIdx * rowHeight;
  return {
    rowKey: getRowKey(row),
    index: topIdx,
    offsetRatio: rowHeight > 0 ? offset / rowHeight : 0,
  };
}

function restoreScroll(snapshot: { rowKey: string | null; index: number; offsetRatio: number }): void {
  const container = document.getElementById('lib-root') as HTMLElement | null;
  if (!container) {
    return;
  }

  const rowHeight = ROW_HEIGHT;
  const idx = findRowIdxByKey(snapshot.rowKey);
  const targetIdx = idx >= 0
    ? idx
    : Math.max(0, Math.min(flat.length - 1, snapshot.index));
  container.scrollTop = targetIdx * rowHeight + snapshot.offsetRatio * rowHeight;
}

function setSelected(idx: number): void {
  selectedIdx = Math.max(-1, Math.min(flat.length - 1, idx));
  list.render();

  if (selectedIdx < 0) {
    return;
  }

  const container = document.getElementById('lib-root') as HTMLElement | null;
  if (!container) {
    return;
  }

  const rowHeight = ROW_HEIGHT;
  const rowTop = selectedIdx * rowHeight;
  if (rowTop < container.scrollTop) {
    container.scrollTop = rowTop;
  }
  if (rowTop + rowHeight > container.scrollTop + container.clientHeight) {
    container.scrollTop = rowTop + rowHeight - container.clientHeight;
  }
}

function renderRow(el: HTMLElement, row: Row, index: number): void {
  el.className = 'lib-row';
  el.removeAttribute('data-path');
  el.removeAttribute('data-public-id');
  el.removeAttribute('role');
  el.removeAttribute('title');

  if (index === selectedIdx) {
    el.classList.add('lib-row--selected');
  }

  const indent = `<span class="lib-indent" style="width:${row.depth * 12}px"></span>`;

  if (row.kind === 'folder') {
    el.classList.add('lib-row--folder');
    if (row.expanded) {
      el.classList.add('lib-row--folder-open');
    }
    el.dataset.path = row.folder.path;
    el.setAttribute('role', 'treeitem');
    el.setAttribute('aria-expanded', String(row.expanded));
    const twistieClass = row.expanded ? 'lib-twistie lib-twistie--open' : 'lib-twistie';
    el.innerHTML = `${indent}<span class="${twistieClass}">${rowIcons.chevron()}</span><span class="lib-icon lib-icon--folder">${folderIcon(row.expanded)}</span><span class="lib-name">${escapeHtml(row.folder.name)}</span>`;
    return;
  }

  if (row.kind === 'asset') {
    el.classList.add('lib-row--asset');
    el.classList.add(`lib-row--${row.asset.resource_type}`);
    if (isAuthenticatedAsset(row.asset)) {
      el.classList.add('lib-row--authenticated');
    }
    el.dataset.publicId = row.asset.public_id;
    el.setAttribute('role', 'treeitem');
    const name =
      row.asset.display_name ||
      row.asset.public_id.split('/').pop() ||
      row.asset.public_id;
    const meta = getAssetMeta(row.asset);
    const authIcon = isAuthenticatedAsset(row.asset)
      ? `<span class="lib-auth-lock" title="Authenticated delivery" aria-label="Authenticated delivery">${rowIcons.lock()}</span>`
      : '';
    el.title = isAuthenticatedAsset(row.asset) ? `${name} · authenticated delivery` : name;
    el.innerHTML = `${indent}<span class="lib-twistie-spacer"></span><span class="lib-icon lib-icon--asset">${assetIcon(row.asset.resource_type)}</span><span class="lib-name">${escapeHtml(name)}</span>${authIcon}<span class="lib-meta">${escapeHtml(meta)}</span>`;
    return;
  }

  if (row.kind === 'clearSearch') {
    el.classList.add('lib-row--clear');
    el.innerHTML = `${indent}<span class="lib-clear-chip"><span class="lib-clear-chip__icon">${rowIcons.close()}</span><span class="lib-clear-chip__label">${escapeHtml(row.label)}</span></span>`;
    return;
  }

  el.classList.add('lib-row--loading');
  el.innerHTML = `${indent}<span class="lib-twistie-spacer"></span><span class="lib-loader-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="lib-name">Loading</span>`;
}

function findFolderIdx(path: string): number {
  return flat.findIndex(
    (row) => row.kind === 'folder' && row.folder.path === path
  );
}

function findAssetRow(publicId: string): Extract<Row, { kind: 'asset' }> | undefined {
  const row = flat.find(
    (item) => item.kind === 'asset' && item.asset.public_id === publicId
  );
  return row && row.kind === 'asset' ? row : undefined;
}

function findAssetIdx(publicId: string): number {
  return flat.findIndex(
    (item) => item.kind === 'asset' && item.asset.public_id === publicId
  );
}

function collapseAt(idx: number): void {
  const row = flat[idx];
  if (row.kind !== 'folder') {
    return;
  }

  row.expanded = false;
  const end = spliceOutRangeAtDepth(
    flat as Array<{ depth: number }>,
    idx,
    row.depth + 1
  );

  flat.splice(idx + 1, end - idx - 1);
  rebuild();
}

function expandAt(idx: number, children: Row[]): void {
  const row = flat[idx];
  if (row.kind !== 'folder') {
    return;
  }

  row.expanded = true;
  flat.splice(idx + 1, 0, ...children);
  rebuild();
}

function toggleFolder(path: string): void {
  const idx = findFolderIdx(path);
  if (idx < 0) {
    return;
  }

  const row = flat[idx];
  if (row.kind !== 'folder') {
    return;
  }

  if (row.expanded) {
    collapseAt(idx);
    return;
  }

  const cached = childrenByFolder.get(path);
  if (cached) {
    expandAt(idx, cached);
    return;
  }

  expandAt(idx, [{ kind: 'loading', depth: row.depth + 1 }]);
  getVSCode()?.postMessage({ command: 'expandFolder', path });
}

function onRootData(folders: ClientFolder[], assets: ClientAsset[], hasMore: boolean): void {
  const scrollSnapshot = snapshotScroll();
  hideEmptyState();
  clearError();
  searchMode = null;
  setSearchInputValue('');
  flat.length = 0;
  childrenByFolder.clear();

  for (const folder of folders) {
    flat.push({ kind: 'folder', folder, depth: 0, expanded: false });
  }

  for (const asset of assets) {
    flat.push({ kind: 'asset', asset, depth: 0 });
  }

  if (hasMore) {
    flat.push({ kind: 'loading', depth: 0 });
  }

  if (flat.length > 0 && selectedIdx < 0) {
    selectedIdx = 0;
  } else if (selectedIdx >= flat.length) {
    selectedIdx = flat.length - 1;
  }

  rebuild();
  restoreScroll(scrollSnapshot);
}

function onRootAssetsAppended(assets: ClientAsset[], hasMore: boolean): void {
  const loadingIdx = flat.findIndex((row) => row.kind === 'loading' && row.depth === 0);
  if (loadingIdx >= 0) {
    flat.splice(loadingIdx, 1);
  }

  for (const asset of assets) {
    flat.push({ kind: 'asset', asset, depth: 0 });
  }

  if (hasMore) {
    flat.push({ kind: 'loading', depth: 0 });
  }

  rebuild();
}

function onFolderData(
  path: string,
  folders: ClientFolder[],
  assets: ClientAsset[],
  hasMore: boolean
): void {
  const scrollSnapshot = snapshotScroll();
  hideEmptyState();
  clearError();
  const idx = findFolderIdx(path);
  if (idx < 0) {
    return;
  }

  const row = flat[idx];
  if (row.kind !== 'folder') {
    return;
  }

  const depth = row.depth + 1;
  const children: Row[] = [];

  for (const folder of folders) {
    children.push({ kind: 'folder', folder, depth, expanded: false });
  }

  for (const asset of assets) {
    children.push({ kind: 'asset', asset, depth });
  }

  if (hasMore) {
    children.push({ kind: 'loading', depth });
  }

  childrenByFolder.set(path, children.slice());

  const end = spliceOutRangeAtDepth(
    flat as Array<{ depth: number }>,
    idx,
    depth
  );

  flat.splice(idx + 1, end - idx - 1, ...children);
  row.expanded = true;
  rebuild();
  restoreScroll(scrollSnapshot);
}

function onNestedAssetsAppended(
  path: string,
  assets: ClientAsset[],
  hasMore: boolean
): void {
  const idx = findFolderIdx(path);
  if (idx < 0) {
    return;
  }

  const folderRow = flat[idx];
  if (folderRow.kind !== 'folder') {
    return;
  }

  const depth = folderRow.depth + 1;

  const newRows: Row[] = assets.map((asset) => ({
    kind: 'asset',
    asset,
    depth,
  }));

  if (hasMore) {
    newRows.push({ kind: 'loading', depth });
  }

  const cachedChildren = childrenByFolder.get(path) || [];
  const nextCachedChildren = cachedChildren.filter(
    (child) => !(child.kind === 'loading' && child.depth === depth)
  );
  nextCachedChildren.push(...newRows);
  childrenByFolder.set(path, nextCachedChildren);

  if (!folderRow.expanded) {
    return;
  }

  let end = spliceOutRangeAtDepth(
    flat as Array<{ depth: number }>,
    idx,
    depth
  );

  if (end > idx + 1) {
    const lastChild = flat[end - 1];
    if (lastChild.kind === 'loading' && lastChild.depth === depth) {
      flat.splice(end - 1, 1);
      end--;
    }
  }

  flat.splice(end, 0, ...newRows);

  rebuild();
}

function onSearchData(query: string, assets: ClientAsset[], hasMore: boolean): void {
  const scrollSnapshot = snapshotScroll();
  hideEmptyState();
  clearError();
  searchMode = { query };
  setSearchInputValue(query);
  flat.length = 0;
  childrenByFolder.clear();
  flat.push({ kind: 'clearSearch', label: `Clear search: ${query}`, depth: 0 });
  for (const asset of assets) {
    flat.push({ kind: 'asset', asset, depth: 0 });
  }
  if (hasMore) {
    flat.push({ kind: 'loading', depth: 0 });
  }
  selectedIdx = flat.length > 0 ? 0 : -1;
  rebuild();
  restoreScroll(scrollSnapshot);
}

function onSearchAppended(assets: ClientAsset[], hasMore: boolean): void {
  if (!searchMode) {
    return;
  }

  const loadingIdx = flat.findIndex((row) => row.kind === 'loading');
  if (loadingIdx >= 0) {
    flat.splice(loadingIdx, 1);
  }
  for (const asset of assets) {
    flat.push({ kind: 'asset', asset, depth: 0 });
  }
  if (hasMore) {
    flat.push({ kind: 'loading', depth: 0 });
  }
  rebuild();
}

function onEnvChanged(cloudName: string, hasConfig: boolean): void {
  clearError();
  flat.length = 0;
  childrenByFolder.clear();
  searchMode = null;
  selectedIdx = -1;
  rebuild();

  const envEl = document.getElementById('lib-env');
  if (envEl) {
    envEl.textContent = hasConfig && cloudName ? cloudName : '';
  }

  // Reset inline search bar so stale queries do not survive an env switch.
  const searchInput = document.getElementById('lib-search-input') as HTMLInputElement | null;
  const searchClear = document.getElementById('lib-search-clear') as HTMLButtonElement | null;
  if (searchInput) {
    searchInput.value = '';
  }
  searchClear?.classList.add('hidden');

  if (!hasConfig) {
    showEmptyState('Connect your Cloudinary account to browse media', 'welcome');
    return;
  }

  hideEmptyState();
}

window.addEventListener('message', (event: MessageEvent<InboundMessage>) => {
  const message = event.data;
  switch (message.command) {
    case 'rootData':
      onRootData(message.folders, message.assets, message.hasMore);
      break;
    case 'folderData':
      onFolderData(
        message.path,
        message.folders,
        message.assets,
        message.hasMore
      );
      break;
    case 'assetsAppended':
      if (message.path === '') {
        onRootAssetsAppended(message.assets, message.hasMore);
      } else {
        onNestedAssetsAppended(message.path, message.assets, message.hasMore);
      }
      break;
    case 'searchData':
      onSearchData(message.query, message.assets, message.hasMore);
      break;
    case 'searchAppended':
      onSearchAppended(message.assets, message.hasMore);
      break;
    case 'envChanged':
      onEnvChanged(message.cloudName, message.hasConfig);
      break;
    case 'viewStateChanged':
      syncFilterUi(message.resourceTypeFilter, message.sortDirection);
      break;
    case 'error':
      showError(message.message);
      break;
    default:
      break;
  }
});

function initFilterBar(): void {
  const typeSel = document.getElementById('lib-filter-type') as HTMLSelectElement | null;
  const sortSel = document.getElementById('lib-filter-sort') as HTMLSelectElement | null;

  const send = (): void => {
    if (!typeSel || !sortSel) {
      return;
    }
    getVSCode()?.postMessage({
      command: 'setView',
      resourceTypeFilter: typeSel.value,
      sortDirection: sortSel.value,
    });
  };

  typeSel?.addEventListener('change', send);
  sortSel?.addEventListener('change', send);
}

function syncFilterUi(resourceTypeFilter: string, sortDirection: string): void {
  const typeSel = document.getElementById('lib-filter-type') as HTMLSelectElement | null;
  const sortSel = document.getElementById('lib-filter-sort') as HTMLSelectElement | null;
  if (typeSel && typeSel.value !== resourceTypeFilter) {
    typeSel.value = resourceTypeFilter;
  }
  if (sortSel && sortSel.value !== sortDirection) {
    sortSel.value = sortDirection;
  }
}

function setSearchInputValue(value: string): void {
  const input = document.getElementById('lib-search-input') as HTMLInputElement | null;
  const clearBtn = document.getElementById('lib-search-clear') as HTMLButtonElement | null;
  if (input && input.value !== value) {
    input.value = value;
  }
  clearBtn?.classList.toggle('hidden', value.trim() === '');
}

function initSearchBar(): void {
  const input = document.getElementById('lib-search-input') as HTMLInputElement | null;
  const clearBtn = document.getElementById('lib-search-clear') as HTMLButtonElement | null;
  if (!input) {
    return;
  }

  input.addEventListener('input', () => {
    clearBtn?.classList.toggle('hidden', input.value.trim() === '');
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const query = input.value.trim();
      if (query) {
        getVSCode()?.postMessage({ command: 'searchAssets', query });
      }
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (input.value !== '') {
        setSearchInputValue('');
        getVSCode()?.postMessage({ command: 'clearSearch' });
        return;
      }
      document.getElementById('lib-root')?.focus();
    }
  });

  clearBtn?.addEventListener('click', () => {
    setSearchInputValue('');
    input.focus();
    getVSCode()?.postMessage({ command: 'clearSearch' });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('lib-root') as HTMLElement;
  container.setAttribute('tabindex', '0');
  list = new VirtualList<Row>({
    container,
    rowHeight: ROW_HEIGHT,
    renderRow,
  });
  document.documentElement.style.setProperty('--lib-row-height', `${ROW_HEIGHT}px`);

  document.querySelectorAll<HTMLButtonElement>('#lib-toolbar .lib-tb-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (!action) {
        return;
      }
      getVSCode()?.postMessage({ command: 'runToolbar', action });
    });
  });

  initSearchBar();
  initFilterBar();

  container.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const rowEl = target.closest('.lib-row') as HTMLElement | null;
    if (!rowEl) {
      return;
    }

    if (rowEl.classList.contains('lib-row--folder')) {
      const path = rowEl.dataset.path || '';
      const idx = findFolderIdx(path);
      setSelected(idx);
      toggleFolder(path);
      return;
    }

    if (rowEl.classList.contains('lib-row--clear')) {
      setSelected(0);
      getVSCode()?.postMessage({ command: 'clearSearch' });
      return;
    }

    if (rowEl.classList.contains('lib-row--asset')) {
      const publicId = rowEl.dataset.publicId || '';
      const idx = findAssetIdx(publicId);
      setSelected(idx);
      const row = findAssetRow(publicId);
      if (row) {
        getVSCode()?.postMessage({ command: 'openAsset', asset: row.asset });
      }
    }
  });

  container.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const rowEl = (event.target as HTMLElement).closest('.lib-row') as HTMLElement | null;
    if (!rowEl) {
      return;
    }

    if (rowEl.classList.contains('lib-row--asset')) {
      const publicId = rowEl.dataset.publicId || '';
      const row = findAssetRow(publicId);
      if (!row) {
        return;
      }

      setSelected(findAssetIdx(publicId));
      showMenu(
        event.clientX,
        event.clientY,
        [
          { label: 'Copy URL', action: 'copyUrl', icon: menuIcons.link() },
          { label: 'Copy Public ID', action: 'copyPublicId', icon: menuIcons.hash() },
          {
            label: 'Copy Optimized URL',
            action: 'copyOptimizedUrl',
            icon: menuIcons.bolt(),
          },
        ],
        (action) => {
          getVSCode()?.postMessage({
            command: 'contextAction',
            action,
            data: row.asset,
          });
        }
      );
      return;
    }

    if (rowEl.classList.contains('lib-row--folder')) {
      const path = rowEl.dataset.path || '';
      const idx = findFolderIdx(path);
      const row = idx >= 0 ? flat[idx] : undefined;
      if (!row || row.kind !== 'folder') {
        return;
      }

      setSelected(idx);
      showMenu(
        event.clientX,
        event.clientY,
        [
          {
            label: 'Upload here',
            action: 'uploadToFolder',
            icon: menuIcons.upload(),
          },
        ],
        (action) => {
          getVSCode()?.postMessage({
            command: 'contextAction',
            action,
            data: row.folder,
          });
        }
      );
    }
  });

  container.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(selectedIdx + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(selectedIdx - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const row = flat[selectedIdx];
      if (row && row.kind === 'folder' && !row.expanded) {
        toggleFolder(row.folder.path);
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const row = flat[selectedIdx];
      if (row && row.kind === 'folder' && row.expanded) {
        toggleFolder(row.folder.path);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = flat[selectedIdx];
      if (row?.kind === 'asset') {
        getVSCode()?.postMessage({ command: 'openAsset', asset: row.asset });
      } else if (row?.kind === 'folder') {
        toggleFolder(row.folder.path);
      } else if (row?.kind === 'clearSearch') {
        getVSCode()?.postMessage({ command: 'clearSearch' });
      }
    }
  });

  getVSCode()?.postMessage({ command: 'ready' });
});
