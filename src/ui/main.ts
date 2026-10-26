import './style.css';
import { toUnicode } from '../engine/cell';
import { isSpace, layout, MIN_CELLS_PER_ROW, usedLength, type SlateLayout } from '../engine/layout';
import { hasGrade, translate } from '../engine/translate';
import type { Grade } from '../engine/types';
import { enableGridKeys, enableTooltip, renderSlate, type View } from './render';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('controls');
const textIn = $<HTMLTextAreaElement>('text');
const cellsIn = $<HTMLInputElement>('cells');
const rowsIn = $<HTMLInputElement>('rows');
const gradeIn = $<HTMLSelectElement>('grade');
const gradeStatus = $('grade-status');
const pagesEl = $('pages');
const summaryEl = $('summary');
const warningsEl = $('warnings');
const emptyEl = $('empty');
const unicodeOut = $<HTMLTextAreaElement>('unicode-out');
const copyBtn = $<HTMLButtonElement>('copy');
const live = $('live');

// ---- Settings persistence (per browser; harmless if storage is unavailable) ----

const STORAGE_KEY = 'brailletraductor:v1';
interface Saved {
  text: string;
  cells: string;
  rows: string;
  grade: string;
  view: View;
}
const DEFAULTS: Saved = { text: 'Hello, World!', cells: '28', rows: '', grade: '1', view: 'write' };

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Saved>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function save(s: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or blocked storage: settings just won't persist.
  }
}

// ---- Form setup ----

const saved = load();
textIn.value = saved.text;
cellsIn.value = saved.cells;
rowsIn.value = saved.rows;
gradeIn.value = saved.grade;
if (gradeIn.selectedIndex < 0) gradeIn.value = '1';
form.querySelector<HTMLInputElement>(`input[name="view"][value="${saved.view}"]`)!.checked = true;

const currentView = (): View =>
  (form.querySelector<HTMLInputElement>('input[name="view"]:checked')?.value as View) ?? 'write';

function setError(input: HTMLInputElement, message: string | null): void {
  const err = $(`${input.id}-error`);
  err.textContent = message ?? '';
  err.hidden = message === null;
  input.setAttribute('aria-invalid', String(message !== null));
}

function readWholeNumber(input: HTMLInputElement, min: number, max: number, optional: boolean) {
  const raw = input.value.trim();
  if (raw === '' && optional) return { value: null, error: null };
  const n = Number(raw);
  if (raw === '' || !Number.isInteger(n) || n < min || n > max) {
    return { value: undefined, error: `Enter a whole number from ${min} to ${max}.` };
  }
  return { value: n, error: null };
}

// ---- Grade 2 (loaded on demand) ----

let gradeLoading = false;

async function ensureGrade(grade: Grade): Promise<void> {
  if (gradeLoading || grade !== 2) return;
  gradeLoading = true;
  gradeStatus.textContent = 'Loading Grade 2 rules…';
  gradeStatus.hidden = false;
  live.textContent = 'Loading Grade 2 braille rules.';
  try {
    const { loadGrade2 } = await import('./grade2-loader');
    await loadGrade2();
    gradeStatus.hidden = true;
    gradeStatus.textContent = '';
  } catch (err) {
    console.error(err);
    gradeStatus.textContent = "Couldn't load Grade 2. Showing Grade 1 instead; try again later.";
    live.textContent = gradeStatus.textContent;
    gradeIn.value = '1';
  } finally {
    gradeLoading = false;
  }
  update();
}

// ---- Rendering ----

let lastSlate: SlateLayout | null = null;
let announceTimer: number | undefined;

function unicodeText(slate: SlateLayout): string {
  return slate.pages
    .map((page) =>
      page
        .map((row) =>
          row
            .slice(0, usedLength(row))
            .map((c) => (isSpace(c) ? '⠀' : toUnicode(c!.dots)))
            .join(''),
        )
        .join('\n'),
    )
    .join('\n\n');
}

function update(): void {
  const cells = readWholeNumber(cellsIn, MIN_CELLS_PER_ROW, 80, false);
  const rows = readWholeNumber(rowsIn, 1, 60, true);
  setError(cellsIn, cells.error);
  setError(rowsIn, rows.error);
  save({
    text: textIn.value,
    cells: cellsIn.value,
    rows: rowsIn.value,
    grade: gradeIn.value,
    view: currentView(),
  });
  if (cells.value === undefined || cells.value === null || rows.value === undefined) return;

  const grade = Number(gradeIn.value) as Grade;
  if (!hasGrade(grade)) {
    void ensureGrade(grade);
    return;
  }
  const translation = translate(textIn.value, grade);
  const slate = layout(translation, cells.value, rows.value);
  lastSlate = slate;

  const hasContent = translation.paragraphs.length > 0;
  emptyEl.hidden = hasContent;
  pagesEl.hidden = !hasContent;
  if (hasContent) renderSlate(pagesEl, slate, currentView());
  else pagesEl.replaceChildren();

  const warnings = [...translation.warnings, ...slate.warnings];
  warningsEl.replaceChildren(
    ...warnings.map((w) => Object.assign(document.createElement('li'), { textContent: w })),
  );
  warningsEl.hidden = warnings.length === 0;

  const rowCount = slate.pages.reduce((n, p) => n + p.length, 0);
  const pageCount = slate.pages.length;
  const sizeText =
    `${rowCount} ${rowCount === 1 ? 'row' : 'rows'} of ${slate.cellsPerRow} cells` +
    (slate.rowsPerPage !== null ? ` on ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}` : '');
  summaryEl.textContent = !hasContent
    ? ''
    : currentView() === 'write'
      ? `${sizeText}. Start each row at its right edge, by the row number, and punch right to left.`
      : `${sizeText}. This is how the page reads after you flip it over.`;

  unicodeOut.value = unicodeText(slate);

  // Announce politely, after typing pauses, so screen readers aren't flooded.
  window.clearTimeout(announceTimer);
  announceTimer = window.setTimeout(() => {
    live.textContent = hasContent
      ? `Braille updated: ${sizeText}.${warnings.length ? ` ${warnings.length} note${warnings.length === 1 ? '' : 's'}.` : ''}`
      : 'No message to translate.';
  }, 900);
}

form.addEventListener('input', update);
form.addEventListener('change', update);
form.addEventListener('submit', (e) => e.preventDefault());

copyBtn.addEventListener('click', async () => {
  if (!lastSlate) return;
  const text = unicodeOut.value;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    unicodeOut.select();
    document.execCommand('copy');
  }
  copyBtn.textContent = 'Copied';
  live.textContent = 'Braille text copied to the clipboard.';
  window.setTimeout(() => (copyBtn.textContent = 'Copy braille text'), 2000);
});

enableGridKeys(pagesEl);
enableTooltip(pagesEl, $('tooltip'), currentView);
update();
