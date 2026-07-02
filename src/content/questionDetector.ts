import type { QuestionMetadata } from '../shared/types';

const SOURCE = 'college-board-question-bank' as const;
const MIN_FINGERPRINT_TEXT_LENGTH = 80;
const CONTAINER_SELECTORS = ['[data-question-id]', '[data-testid*="question" i]', 'article', 'main'];
// Real metadata values are short ("Math", "Hard"); the educator filter panel repeats
// the same labels as long help sentences, so we reject anything over this length.
const MAX_METADATA_VALUE_LENGTH = 60;

export async function detectQuestion(root: Document): Promise<QuestionMetadata | null> {
  const container = findSpecificContainer(root);

  // 1) Prefer an explicit, visible question id. This works on the student bank
  //    (data-question-id / "Question ID:" inside an <article>) and on the educator
  //    bank, which renders as a filter/table page with the id as plain body text.
  const visibleId = getVisibleQuestionId(container, root);
  if (visibleId) {
    return {
      source: SOURCE,
      questionKey: visibleId,
      questionKeyMethod: 'visible-id',
      ...extractMetadata(container ?? root.body)
    };
  }

  // 2) Fall back to a local fingerprint of a specific question container only.
  //    We never fingerprint <body>, so list/filter pages don't mint junk keys.
  if (container) {
    const normalizedText = normalizeVisibleText(container.textContent ?? '');
    if (normalizedText.length >= MIN_FINGERPRINT_TEXT_LENGTH) {
      return {
        source: SOURCE,
        questionKey: `sha256_${await sha256(normalizedText.slice(0, 5000))}`,
        questionKeyMethod: 'fingerprint',
        ...extractMetadata(container)
      };
    }
  }

  return null;
}

function findSpecificContainer(root: Document): Element | null {
  for (const selector of CONTAINER_SELECTORS) {
    const match = root.querySelector(selector);
    if (match && normalizeVisibleText(match.textContent ?? '').length > 0) return match;
  }
  return null;
}

function getVisibleQuestionId(container: Element | null, root: Document): string | null {
  const dataId = container?.getAttribute('data-question-id');
  if (dataId?.trim()) return dataId.trim();

  const scopeText = normalizeVisibleText((container ?? root.body)?.textContent ?? '');
  const match = scopeText.match(/Question ID:\s*([A-Za-z0-9_-]+)/i);
  return match?.[1] ?? null;
}

function extractMetadata(
  scope: Element | null
): Pick<QuestionMetadata, 'section' | 'domain' | 'skill' | 'difficulty'> {
  return {
    section: findLabeledValue(scope, 'Section'),
    domain: findLabeledValue(scope, 'Domain'),
    skill: findLabeledValue(scope, 'Skill'),
    difficulty: findLabeledValue(scope, 'Difficulty')
  };
}

// Read "Label: value" from the smallest element whose own text is exactly that pair,
// preferring the shortest value. Reading per-element keeps neighboring nodes (the
// question prompt, "Question ID:", the filter help sentences) from leaking into the value.
function findLabeledValue(scope: Element | null, label: string): string | null {
  if (!scope) return null;

  const pattern = new RegExp(`^${label}:\\s*(.+)$`, 'i');
  let best: string | null = null;

  for (const element of [scope, ...scope.querySelectorAll('*')]) {
    const text = normalizeVisibleText(element.textContent ?? '');
    const match = text.match(pattern);
    if (!match) continue;

    // Drop a trailing standalone number (e.g. a result count next to "Difficulty: Hard 12").
    const value = match[1].trim().replace(/\s+\d+$/, '');
    if (!value || value.length > MAX_METADATA_VALUE_LENGTH) continue;
    if (best === null || value.length < best.length) best = value;
  }

  return best;
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
