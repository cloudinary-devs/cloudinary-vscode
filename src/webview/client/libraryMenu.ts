const MENU_ID = '__lib-menu__';
const VIEWPORT_MARGIN = 8;

export interface MenuItem {
  label: string;
  action: string;
  /** Optional inline SVG markup rendered before the label. */
  icon?: string;
  /** Render a separator before this item. */
  divider?: boolean;
}

interface MenuState {
  el: HTMLElement;
  items: HTMLButtonElement[];
  highlighted: number;
  onPick: (action: string) => void;
}

let active: MenuState | undefined;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function highlight(state: MenuState, idx: number): void {
  if (state.items.length === 0) {
    return;
  }
  const wrapped =
    ((idx % state.items.length) + state.items.length) % state.items.length;
  if (state.highlighted === wrapped) {
    return;
  }
  if (state.highlighted >= 0 && state.items[state.highlighted]) {
    state.items[state.highlighted].classList.remove('lib-menu-item--active');
    state.items[state.highlighted].removeAttribute('aria-current');
  }
  state.highlighted = wrapped;
  const next = state.items[wrapped];
  next.classList.add('lib-menu-item--active');
  next.setAttribute('aria-current', 'true');
}

function pick(state: MenuState, idx: number): void {
  const item = state.items[idx];
  if (!item) {
    return;
  }
  const action = item.dataset.action;
  hideMenu();
  if (action) {
    state.onPick(action);
  }
}

function onDocumentMouseDown(event: MouseEvent): void {
  if (!active) {
    return;
  }
  const target = event.target;
  if (target instanceof Node && active.el.contains(target)) {
    return;
  }
  hideMenu();
}

function onWindowDismiss(): void {
  hideMenu();
}

function onKey(event: KeyboardEvent): void {
  if (!active) {
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    hideMenu();
    return;
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    highlight(active, active.highlighted + 1);
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    highlight(active, active.highlighted - 1);
    return;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    highlight(active, 0);
    return;
  }
  if (event.key === 'End') {
    event.preventDefault();
    highlight(active, active.items.length - 1);
    return;
  }
  if (event.key === 'Enter' || event.key === ' ') {
    if (active.highlighted >= 0) {
      event.preventDefault();
      pick(active, active.highlighted);
    }
  }
}

function attachListeners(): void {
  document.addEventListener('mousedown', onDocumentMouseDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', onWindowDismiss);
  window.addEventListener('resize', onWindowDismiss);
}

function detachListeners(): void {
  document.removeEventListener('mousedown', onDocumentMouseDown, true);
  document.removeEventListener('keydown', onKey, true);
  window.removeEventListener('blur', onWindowDismiss);
  window.removeEventListener('resize', onWindowDismiss);
}

function positionMenu(menu: HTMLElement, anchorX: number, anchorY: number): void {
  // Insert offscreen for measurement.
  menu.style.left = '-9999px';
  menu.style.top = '-9999px';
  menu.style.visibility = 'hidden';
  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxLeft = Math.max(VIEWPORT_MARGIN, vw - rect.width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, vh - rect.height - VIEWPORT_MARGIN);

  // Horizontal: prefer right of cursor; flip to left of cursor if overflow;
  // finally clamp.
  let left = anchorX;
  if (left + rect.width + VIEWPORT_MARGIN > vw) {
    const flipped = anchorX - rect.width;
    left = flipped >= VIEWPORT_MARGIN ? flipped : maxLeft;
  }
  left = clamp(left, VIEWPORT_MARGIN, maxLeft);

  // Vertical: prefer below cursor; flip above; clamp.
  let top = anchorY;
  if (top + rect.height + VIEWPORT_MARGIN > vh) {
    const flipped = anchorY - rect.height;
    top = flipped >= VIEWPORT_MARGIN ? flipped : maxTop;
  }
  top = clamp(top, VIEWPORT_MARGIN, maxTop);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = '';
}

function buildMenu(items: MenuItem[]): { el: HTMLElement; itemEls: HTMLButtonElement[] } {
  const el = document.createElement('div');
  el.className = 'lib-menu';
  el.id = MENU_ID;
  el.setAttribute('role', 'menu');
  el.style.position = 'fixed';

  const itemEls: HTMLButtonElement[] = [];

  for (const item of items) {
    if (item.divider) {
      const sep = document.createElement('div');
      sep.className = 'lib-menu__divider';
      sep.setAttribute('role', 'separator');
      el.appendChild(sep);
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lib-menu-item';
    btn.setAttribute('role', 'menuitem');
    btn.dataset.action = item.action;
    btn.tabIndex = -1;

    const iconMarkup = item.icon
      ? `<span class="lib-menu-item__icon">${item.icon}</span>`
      : '<span class="lib-menu-item__icon" aria-hidden="true"></span>';
    btn.innerHTML = `${iconMarkup}<span class="lib-menu-item__label">${escapeHtml(item.label)}</span>`;

    el.appendChild(btn);
    itemEls.push(btn);
  }

  return { el, itemEls };
}

export function showMenu(
  anchorX: number,
  anchorY: number,
  items: MenuItem[],
  onPick: (action: string) => void
): void {
  hideMenu();

  if (items.length === 0) {
    return;
  }

  const { el, itemEls } = buildMenu(items);
  const state: MenuState = {
    el,
    items: itemEls,
    highlighted: -1,
    onPick,
  };

  positionMenu(el, anchorX, anchorY);

  itemEls.forEach((btn, idx) => {
    btn.addEventListener('click', () => pick(state, idx));
    btn.addEventListener('mouseenter', () => highlight(state, idx));
  });

  active = state;
  highlight(state, 0);

  // Defer to skip the contextmenu event tail.
  setTimeout(() => {
    if (active === state) {
      attachListeners();
    }
  }, 0);
}

export function hideMenu(): void {
  if (!active) {
    document.getElementById(MENU_ID)?.remove();
    return;
  }
  detachListeners();
  active.el.remove();
  active = undefined;
}
