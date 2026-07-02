export type AnswerType = 'mc' | 'grid';

export interface RevealedAnswer {
  letter?: string;
  value?: string;
}

export function detectRevealedAnswer(root: Document): RevealedAnswer | null {
  const text = normalize(root.body?.textContent ?? '');

  const letter = text.match(/Correct Answer:\s*([A-D])\b/i)?.[1]?.toUpperCase();
  if (letter) return { letter };

  // Grid-in: only accept a short, answer-shaped token (math images yield nothing).
  const value = text.match(/Correct Answer:\s*([0-9]+(?:\.[0-9]+)?(?:\/[0-9]+)?)/)?.[1];
  if (value) return { value };

  return null;
}

export function gradeAnswer(selected: string, revealed: RevealedAnswer, type: AnswerType): boolean {
  if (type === 'mc') {
    return Boolean(revealed.letter) && selected.trim().toUpperCase() === revealed.letter;
  }

  const selectedValue = toNumber(selected);
  const revealedValue = revealed.value ? toNumber(revealed.value) : null;
  if (selectedValue === null || revealedValue === null) return false;
  return Math.abs(selectedValue - revealedValue) < 1e-9;
}

function toNumber(raw: string): number | null {
  const trimmed = raw.trim();
  const fraction = trimmed.match(/^(-?[0-9]+)\/([0-9]+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  const decimal = Number(trimmed);
  return Number.isFinite(decimal) ? decimal : null;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
