/// <reference lib="dom" />

export interface WindowInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  totalRows: number;
  buffer: number;
}

export interface WindowRange {
  startIdx: number;
  endIdx: number;
  startOffset: number;
  totalHeight: number;
}

export function computeWindow(input: WindowInput): WindowRange {
  const firstVisible = Math.floor(input.scrollTop / input.rowHeight);
  const visibleCount = Math.ceil(input.viewportHeight / input.rowHeight);
  const startIdx = Math.max(0, firstVisible - input.buffer);
  const endIdx = Math.min(
    input.totalRows,
    firstVisible + visibleCount + input.buffer
  );

  return {
    startIdx,
    endIdx,
    startOffset: startIdx * input.rowHeight,
    totalHeight: input.totalRows * input.rowHeight,
  };
}

export interface VirtualListOpts<T> {
  container: HTMLElement;
  rowHeight: number | (() => number);
  buffer?: number;
  renderRow(el: HTMLElement, item: T, index: number): void;
}

/**
 * Simple fixed-row-height virtual list. Rows are recycled from a pool.
 */
export class VirtualList<T> {
  private items: T[] = [];
  private readonly getRowHeight: () => number;
  private readonly buffer: number;
  private readonly container: HTMLElement;
  private readonly spacer: HTMLDivElement;
  private readonly pool: HTMLDivElement[] = [];
  private readonly renderRow: (el: HTMLElement, item: T, index: number) => void;

  constructor(opts: VirtualListOpts<T>) {
    this.container = opts.container;
    const rowHeight = opts.rowHeight;
    this.getRowHeight = typeof rowHeight === 'function'
      ? rowHeight
      : () => rowHeight;
    this.buffer = opts.buffer ?? 5;
    this.renderRow = opts.renderRow;

    this.container.style.position = 'relative';
    this.container.style.overflowY = 'auto';

    this.spacer = document.createElement('div');
    this.spacer.style.position = 'relative';
    this.spacer.style.width = '100%';
    this.container.appendChild(this.spacer);

    this.container.addEventListener('scroll', () => this.render());
  }

  setItems(items: T[]): void {
    this.items = items;
    this.render();
  }

  appendItems(more: T[]): void {
    this.items = this.items.concat(more);
    this.render();
  }

  render(): void {
    const rowHeight = this.getRowHeight();
    const windowRange = computeWindow({
      scrollTop: this.container.scrollTop,
      viewportHeight: this.container.clientHeight,
      rowHeight,
      totalRows: this.items.length,
      buffer: this.buffer,
    });

    this.spacer.style.height = `${windowRange.totalHeight}px`;

    const needed = windowRange.endIdx - windowRange.startIdx;
    while (this.pool.length < needed) {
      const row = document.createElement('div');
      row.style.position = 'absolute';
      row.style.left = '0';
      row.style.right = '0';
      this.spacer.appendChild(row);
      this.pool.push(row);
    }

    for (let i = 0; i < this.pool.length; i++) {
      const row = this.pool[i];
      row.style.height = `${rowHeight}px`;
      if (i < needed) {
        const idx = windowRange.startIdx + i;
        row.style.top = `${idx * rowHeight}px`;
        row.style.display = '';
        this.renderRow(row, this.items[idx], idx);
      } else {
        row.style.display = 'none';
      }
    }
  }
}
