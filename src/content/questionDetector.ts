import type { QuestionMetadata } from '../shared/types';

const SOURCE = 'college-board-question-bank' as const;
const MIN_FINGERPRINT_TEXT_LENGTH = 80;
const QUESTION_SELECTORS = ['[data-question-id]', '[data-testid*="question" i]', 'article', 'main'];
const METADATA_LABELS = ['Section', 'Domain', 'Skill', 'Difficulty'];

export async function detectQuestion(root: Document): Promise<QuestionMetadata | null> {
  const container = findQuestionContainer(root);
  if (!container) return null;

  const section = findLabeledValue(container, 'Section');
  const domain = findLabeledValue(container, 'Domain');
  const skill = findLabeledValue(container, 'Skill');
  const difficulty = findLabeledValue(container, 'Difficulty');
  const visibleId = getVisibleQuestionId(container);

  if (visibleId) {
    return {
      source: SOURCE,
      questionKey: visibleId,
      questionKeyMethod: 'visible-id',
      section,
      domain,
      skill,
      difficulty
    };
  }

  const normalizedText = normalizeVisibleText(container.textContent ?? '');
  if (normalizedText.length < MIN_FINGERPRINT_TEXT_LENGTH) return null;

  return {
    source: SOURCE,
    questionKey: `sha256_${await sha256(normalizedText.slice(0, 5000))}`,
    questionKeyMethod: 'fingerprint',
    section,
    domain,
    skill,
    difficulty
  };
}

function findQuestionContainer(root: Document): Element | null {
  for (const selector of QUESTION_SELECTORS) {
    const match = root.querySelector(selector);
    if (match && normalizeVisibleText(match.textContent ?? '').length > 0) return match;
  }
  return null;
}

function getVisibleQuestionId(container: Element): string | null {
  const dataId = container.getAttribute('data-question-id');
  if (dataId?.trim()) return dataId.trim();

  const match = normalizeVisibleText(container.textContent ?? '').match(/Question ID:\s*([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function findLabeledValue(container: Element, label: string): string | null {
  const text = normalizeVisibleText(container.textContent ?? '');
  const otherLabels = METADATA_LABELS.filter((candidate) => candidate !== label).join('|');
  const pattern = new RegExp(`${label}:\\s*(.*?)(?=(?:${otherLabels}):|$)`, 'i');
  return text.match(pattern)?.[1]?.trim() || null;
}

function normalizeVisibleText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

async function sha256(value: string): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('crypto.subtle is required to fingerprint questions');
  }

  const bytes = new TextEncoder().encode(value);
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
