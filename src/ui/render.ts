// DOM rendering for the slate. All braille knowledge comes from the engine; this file only draws
// what layout() returns and wires up keyboard navigation and the hover/focus tooltip.

import { describeDots, mirror, toUnicode, type Dots } from '../engine/cell';
import { isSpace, type Row, type SlateLayout } from '../engine/layout';
import type { BrailleCell } from '../engine/types';

export type View = 'write' | 'read';

interface SlotInfo {
  cell: BrailleCell | null;
  /** Dots as drawn in the current view (mirrored on the writing side). */
  shownDots: Dots;
  /** 1-based position in the finished row, counting from the reader's left margin. */
  position: number;
}

/** What each rendered slot shows, for the tooltip. */
const slotData = new WeakMap<HTMLElement, SlotInfo>();

/**
 * Slots in the order they're written, which is also reading order: position 1 first. The writing
 * side is flipped right to left with CSS (`direction: rtl`), not by reordering the DOM, so screen
 * readers, arrow keys and column numbers all follow the order you punch the cells.
 */
function slotsFor(row: Row, view: View): SlotInfo[] {
  return row.map((cell, i) => {
    const filled = isSpace(cell) ? null : cell;
    const dots = filled ? filled.dots : 0;
    return { cell: filled, shownDots: view === 'write' ? mirror(dots) : dots, position: i + 1 };
  });
}

/** A six-dot cell drawing: dots 1-2-3 down the left column, 4-5-6 down the right. */
export function cellGraphic(dots: Dots, className = 'cell-graphic'): HTMLElement {
  const el = document.createElement('span');
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement('span');
    dot.className = dots & (1 << i) ? 'dot raised' : 'dot';
    el.append(dot);
  }
  return el;
}

/** Screen reader label: what the cell is first, then where it is. */
function cellLabel(slot: SlotInfo, rowNumber: number, width: number, view: View): string {
  const where = `row ${rowNumber}, cell ${slot.position} of ${width}${
    view === 'write' ? ' from the right' : ''
  }`;
  if (!slot.cell) return `Empty. ${where}`;
  return `${slot.cell.name}, ${describeDots(slot.cell.dots)}. ${where}`;
}

function ruler(width: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ruler';
  el.setAttribute('aria-hidden', 'true');
  el.append(document.createElement('span'));
  for (let n = 1; n <= width; n++) {
    const tick = document.createElement('span');
    tick.className = 'tick';
    if (n === 1 || n % 5 === 0) tick.textContent = String(n);
    el.append(tick);
  }
  el.append(document.createElement('span'));
  return el;
}

export function renderSlate(container: HTMLElement, slate: SlateLayout, view: View): void {
  container.replaceChildren();
  container.style.setProperty('--cells', String(slate.cellsPerRow));
  const paged = slate.rowsPerPage !== null;
  let rowNumber = 0;

  slate.pages.forEach((rows, pageIndex) => {
    const page = document.createElement('div');
    page.className = 'page';
    const pageName = paged ? `Page ${pageIndex + 1}` : 'Slate';
    if (paged) {
      const h = document.createElement('h3');
      h.textContent = pageName;
      page.append(h);
    }

    const scroller = document.createElement('div');
    scroller.className = 'slate-scroll';
    const grid = document.createElement('div');
    grid.className = `slate view-${view}`;
    grid.setAttribute('role', 'grid');
    grid.setAttribute(
      'aria-label',
      `${pageName}, ${view === 'write' ? 'writing side, mirrored' : 'reading side'}`,
    );
    grid.setAttribute('aria-describedby', 'slate-help');
    grid.append(ruler(slate.cellsPerRow));

    for (const row of rows) {
      rowNumber++;
      const rowEl = document.createElement('div');
      rowEl.className = 'slate-row';
      rowEl.setAttribute('role', 'row');

      const startLabel = document.createElement('span');
      startLabel.className = 'row-num start';
      startLabel.setAttribute('aria-hidden', 'true');
      startLabel.textContent = view === 'write' ? `← ${rowNumber}` : String(rowNumber);
      startLabel.title = view === 'write' ? 'Start this row here, at the right' : '';
      const endSpacer = document.createElement('span');
      endSpacer.className = 'row-num';
      endSpacer.setAttribute('aria-hidden', 'true');

      rowEl.append(startLabel);
      for (const slot of slotsFor(row, view)) {
        const cellEl = document.createElement('span');
        cellEl.className = slot.cell ? 'slot' : 'slot empty';
        cellEl.setAttribute('role', 'gridcell');
        cellEl.tabIndex = -1;
        cellEl.setAttribute('aria-label', cellLabel(slot, rowNumber, slate.cellsPerRow, view));
        cellEl.dataset.row = String(rowNumber);
        cellEl.dataset.position = String(slot.position);
        if (slot.cell) cellEl.append(cellGraphic(slot.shownDots));
        slotData.set(cellEl, slot);
        rowEl.append(cellEl);
      }
      rowEl.append(endSpacer);
      grid.append(rowEl);
    }

    scroller.append(grid);
    page.append(scroller);
    container.append(page);
    // Rows start at the right on the writing side, so if the slate is wider than the screen,
    // show the right edge first.
    if (view === 'write') scroller.scrollLeft = scroller.scrollWidth;
  });

  // Roving tab stop: one Tab enters the slate at the first cell of row 1 (the rightmost cell on
  // the writing side), and arrow keys move around inside it.
  const first = container.querySelector<HTMLElement>('.slot[data-row="1"][data-position="1"]');
  if (first) first.tabIndex = 0;
}

function moveFocus(from: HTMLElement, to: HTMLElement | null | undefined): void {
  if (!to) return;
  from.tabIndex = -1;
  to.tabIndex = 0;
  to.focus();
}

/** Arrow-key navigation within and between rows (and across pages). */
export function enableGridKeys(container: HTMLElement): void {
  container.addEventListener('keydown', (e) => {
    const current = e.target as HTMLElement;
    if (!current.classList.contains('slot')) return;
    const row = current.parentElement!;
    const rowCells = [...row.querySelectorAll<HTMLElement>('.slot')];
    const allRows = [...container.querySelectorAll<HTMLElement>('.slate-row')];
    const rowIndex = allRows.indexOf(row);
    const col = rowCells.indexOf(current);
    // On the writing side the row runs right to left, so the left arrow moves to the next cell.
    const step = row.closest('.view-write') ? -1 : 1;
    const cellAt = (r: number, c: number) => allRows[r]?.querySelectorAll<HTMLElement>('.slot')[c];

    let target: HTMLElement | null | undefined;
    switch (e.key) {
      case 'ArrowRight':
        target = rowCells[col + step];
        break;
      case 'ArrowLeft':
        target = rowCells[col - step];
        break;
      case 'ArrowDown':
        target = cellAt(rowIndex + 1, col);
        break;
      case 'ArrowUp':
        target = cellAt(rowIndex - 1, col);
        break;
      case 'Home':
        target = e.ctrlKey ? cellAt(0, 0) : rowCells[0];
        break;
      case 'End':
        target = e.ctrlKey ? cellAt(allRows.length - 1, rowCells.length - 1) : rowCells.at(-1);
        break;
      default:
        return;
    }
    e.preventDefault();
    moveFocus(current, target);
  });
}

function tooltipContent(slot: SlotInfo, view: View): HTMLElement {
  const wrap = document.createElement('div');
  const cell = slot.cell!;

  const title = document.createElement('p');
  title.className = 'tooltip-title';
  if (cell.print) {
    const big = document.createElement('span');
    big.className = 'tooltip-print';
    big.textContent = cell.print;
    title.append(big, ' ');
  }
  title.append(cell.name);
  wrap.append(title);

  const pics = document.createElement('div');
  pics.className = 'tooltip-pics';
  const fig = (label: string, dots: Dots) => {
    const f = document.createElement('figure');
    const cap = document.createElement('figcaption');
    cap.textContent = label;
    f.append(cellGraphic(dots, 'cell-graphic large'), cap);
    return f;
  };
  pics.append(fig('Reading side', cell.dots), fig('Writing side', mirror(cell.dots)));
  wrap.append(pics);

  const meta = document.createElement('p');
  meta.className = 'tooltip-meta';
  meta.textContent = `${describeDots(cell.dots)} · ${toUnicode(cell.dots)} · cell ${slot.position}${
    view === 'write' ? ' from the right' : ''
  }`;
  wrap.append(meta);
  return wrap;
}

/** Show the tooltip for whichever cell is hovered or focused. */
export function enableTooltip(container: HTMLElement, tooltip: HTMLElement, getView: () => View) {
  let shownFor: HTMLElement | null = null;

  const show = (el: HTMLElement) => {
    const slot = slotData.get(el);
    if (!slot?.cell) return hide();
    shownFor = el;
    tooltip.replaceChildren(tooltipContent(slot, getView()));
    tooltip.hidden = false;
    place(el);
  };
  const place = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const t = tooltip.getBoundingClientRect();
    const margin = 8;
    let left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - t.width - margin));
    let top = r.top - t.height - margin;
    if (top < margin) top = r.bottom + margin;
    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${top + window.scrollY}px`;
  };
  const hide = () => {
    shownFor = null;
    tooltip.hidden = true;
  };

  container.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.slot');
    if (el && el !== shownFor) show(el);
  });
  container.addEventListener('mouseleave', () => {
    if (!container.contains(document.activeElement)) hide();
  });
  container.addEventListener('focusin', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.slot');
    if (el) show(el);
  });
  container.addEventListener('focusout', (e) => {
    if (!container.contains(e.relatedTarget as Node | null)) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  // Focusing an off-screen cell scrolls it into view, so follow the cell rather than hiding.
  // Capture catches the slate's own horizontal scrolling too.
  const follow = () => {
    if (shownFor) place(shownFor);
  };
  document.addEventListener('scroll', follow, { capture: true, passive: true });
  window.addEventListener('resize', follow);
}
