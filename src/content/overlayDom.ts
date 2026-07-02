import { validateNote } from '../shared/noteValidation';
import type { QuestionMetadata, QuestionNote, QuestionProgress, StudyStatus, SyncState } from '../shared/types';
import { detectQuestion } from './questionDetector';
import { createInitialProgress, updateProgressStatus } from './progressModel';

type ProgressResponse = { ok: true; progress: QuestionProgress | null } | { ok: false; error: string };
type NoteResponse = { ok: true; note: QuestionNote | null } | { ok: false; error: string };
type SaveResponse = { ok: true } | { ok: false; error: string };

type OverlayServices = {
  detect: (root: Document) => Promise<QuestionMetadata | null>;
  document: Document;
  now: () => string;
  sendMessage: <T>(message: unknown) => Promise<T>;
  // Debounce for re-detecting after the host page's DOM changes (SPA navigation).
  redetectDelayMs: number;
};

const STATUS_ACTIONS: Array<{ status: StudyStatus; label: string }> = [
  { status: 'correct', label: 'Correct' },
  { status: 'missed', label: 'Missed' },
  { status: 'unsure', label: 'Unsure' },
  { status: 'review', label: 'Review' },
  { status: 'unseen', label: 'Clear' }
];

export function mountOverlay(container: HTMLElement, overrides: Partial<OverlayServices> = {}) {
  const services: OverlayServices = {
    detect: detectQuestion,
    document,
    now: () => new Date().toISOString(),
    sendMessage: <T>(message: unknown) => chrome.runtime.sendMessage(message) as Promise<T>,
    redetectDelayMs: 500,
    ...overrides
  };

  let metadata: QuestionMetadata | null = null;
  let progress: QuestionProgress | null = null;
  let note = '';
  let syncState: SyncState = 'saved';
  let message = '';
  let lastDetectedKey: string | null = null;
  let loadToken = 0;
  let redetectTimer: ReturnType<typeof setTimeout> | undefined;

  const ready = loadQuestionState();

  // The question banks are single-page apps: questions open/switch without a full
  // page load, so re-detect (debounced) whenever the page DOM changes. The overlay's
  // own root lives outside <body>, so our renders don't retrigger this.
  const observer = new MutationObserver(() => {
    clearTimeout(redetectTimer);
    redetectTimer = setTimeout(() => void redetect(), services.redetectDelayMs);
  });
  if (services.document.body) {
    observer.observe(services.document.body, { childList: true, subtree: true });
  }

  async function redetect() {
    const detected = await services.detect(services.document);
    if ((detected?.questionKey ?? null) !== lastDetectedKey) {
      await loadQuestionState();
    }
  }

  async function loadQuestionState() {
    const token = ++loadToken;
    renderMessage('Loading question state...');
    metadata = await services.detect(services.document);
    if (token !== loadToken) return;
    lastDetectedKey = metadata?.questionKey ?? null;

    if (!metadata) {
      progress = null;
      note = '';
      renderMessage('Question not recognized on this page.');
      return;
    }

    const progressResponse = await services.sendMessage<ProgressResponse>({
      type: 'progress:get',
      source: metadata.source,
      questionKey: metadata.questionKey
    });
    const noteResponse = await services.sendMessage<NoteResponse>({
      type: 'note:get',
      source: metadata.source,
      questionKey: metadata.questionKey
    });
    if (token !== loadToken) return;

    progress = progressResponse.ok && progressResponse.progress
      ? progressResponse.progress
      : createInitialProgress(metadata, services.now());
    note = noteResponse.ok && noteResponse.note ? noteResponse.note.note : '';
    message = progressResponse.ok && noteResponse.ok ? '' : 'Local state could not be loaded.';

    if (progressResponse.ok && !progressResponse.progress) {
      await services.sendMessage<SaveResponse>({ type: 'progress:save', progress });
    }

    renderPanel();
  }

  async function saveStatus(status: StudyStatus) {
    if (!progress) return;

    progress = updateProgressStatus(progress, status, services.now());
    syncState = 'saving';
    renderPanel();

    const response = await services.sendMessage<SaveResponse>({ type: 'progress:save', progress });
    syncState = response.ok ? 'saved' : 'sync-delayed';
    message = response.ok ? '' : response.error;
    renderPanel();
  }

  async function saveNote(value: string) {
    if (!metadata) return;

    const validation = validateNote(value);
    if (!validation.ok) {
      message = validation.reason === 'NOTE_TOO_LONG'
        ? 'Note is over the 2,000 character limit.'
        : 'Notes should not include copied question content.';
      renderPanel();
      return;
    }

    note = validation.value;
    syncState = 'saving';
    renderPanel();

    const response = await services.sendMessage<SaveResponse>({
      type: 'note:save',
      note: {
        source: metadata.source,
        questionKey: metadata.questionKey,
        note: validation.value,
        updatedAt: services.now()
      }
    });
    syncState = response.ok ? 'saved' : 'sync-delayed';
    message = response.ok ? '' : response.error;
    renderPanel();
  }

  function renderMessage(text: string) {
    const panel = createElement('aside', 'qbo-panel');
    panel.setAttribute('aria-live', 'polite');
    appendTextElement(panel, 'h1', 'Question Bank Overlay');
    appendTextElement(panel, 'p', text);
    container.replaceChildren(panel);
  }

  function renderPanel() {
    if (!metadata || !progress) {
      renderMessage(message || 'Question not recognized on this page.');
      return;
    }

    const panel = createElement('aside', 'qbo-panel');
    panel.setAttribute('aria-label', 'Question Bank Overlay');

    const header = createElement('header', 'qbo-header');
    const titleBlock = createElement('div');
    appendTextElement(titleBlock, 'h1', 'Question Bank Overlay');
    appendTextElement(titleBlock, 'p', syncStateLabel(syncState));
    const status = appendTextElement(header, 'span', progress.status);
    status.className = 'qbo-status';
    header.prepend(titleBlock);
    panel.append(header);

    const metadataRows = [
      ['Section', metadata.section],
      ['Domain', metadata.domain],
      ['Skill', metadata.skill],
      ['Difficulty', metadata.difficulty]
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));

    if (metadataRows.length > 0) {
      const list = createElement('dl', 'qbo-metadata');
      for (const [label, value] of metadataRows) {
        const row = createElement('div');
        appendTextElement(row, 'dt', label);
        appendTextElement(row, 'dd', value);
        list.append(row);
      }
      panel.append(list);
    }

    const actions = createElement('div', 'qbo-actions');
    actions.setAttribute('aria-label', 'Study status');
    for (const action of STATUS_ACTIONS) {
      const button = appendTextElement(actions, 'button', action.label);
      button.dataset.status = action.status;
      button.type = 'button';
      if (progress.status === action.status) button.classList.add('is-active');
      button.addEventListener('click', () => void saveStatus(action.status));
    }
    panel.append(actions);

    const label = createElement('label', 'qbo-note');
    label.append(document.createTextNode('Private note'));
    const textarea = createElement('textarea');
    textarea.maxLength = 2000;
    textarea.placeholder = 'Keep this in your own words.';
    textarea.value = note;
    textarea.addEventListener('input', () => {
      note = textarea.value;
    });
    textarea.addEventListener('blur', () => void saveNote(textarea.value));
    label.append(textarea);
    panel.append(label);

    const footer = createElement('footer', 'qbo-footer');
    appendTextElement(footer, 'span', `Attempts: ${progress.attemptCount}`);
    appendTextElement(footer, 'span', message);
    panel.append(footer);

    container.replaceChildren(panel);
  }

  return {
    ready,
    destroy: () => {
      observer.disconnect();
      clearTimeout(redetectTimer);
      container.replaceChildren();
    }
  };
}

function syncStateLabel(syncState: SyncState): string {
  if (syncState === 'saving') return 'Saving locally';
  if (syncState === 'sync-delayed') return 'Sync delayed';
  if (syncState === 'needs-sign-in') return 'Sign in to sync';
  if (syncState === 'offline') return 'Offline';
  return 'Saved locally';
}

function createElement<K extends keyof HTMLElementTagNameMap>(tagName: K, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function appendTextElement<K extends keyof HTMLElementTagNameMap>(
  parent: Element,
  tagName: K,
  text: string
): HTMLElementTagNameMap[K] {
  const element = createElement(tagName);
  element.textContent = text;
  parent.append(element);
  return element;
}
