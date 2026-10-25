import { grade1 } from './grade1';
import type { Grade, Translation, Translator } from './types';

/**
 * Registered translators. Grade 1 is built in; Grade 2 needs liblouis, which the caller loads and
 * registers with registerTranslator() (see grade2.ts).
 */
const TRANSLATORS: Partial<Record<Grade, Translator>> = {
  1: grade1,
};

export function registerTranslator(translator: Translator): void {
  TRANSLATORS[translator.grade] = translator;
}

export function hasGrade(grade: Grade): boolean {
  return TRANSLATORS[grade] !== undefined;
}

/** Translate print text. Each line of input becomes its own paragraph; blank lines are kept. */
export function translate(text: string, grade: Grade = 1): Translation {
  const translator = TRANSLATORS[grade];
  if (!translator) throw new Error(`Grade ${grade} braille is not available yet.`);
  const warnings = new Set<string>();
  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => translator.translateParagraph(line.split(/\s+/).filter(Boolean), warnings));
  // Drop trailing empty paragraphs so a final newline doesn't waste a slate row.
  while (paragraphs.length > 0 && paragraphs[paragraphs.length - 1]!.length === 0) paragraphs.pop();
  return { paragraphs, warnings: [...warnings] };
}
