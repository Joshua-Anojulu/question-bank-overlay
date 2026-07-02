import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { QuestionNote, QuestionProgress, QuestionSource } from '../shared/types';

const DB_NAME = 'question-bank-overlay';
const DB_VERSION = 2;

interface StoredProgress extends QuestionProgress {
  localKey: string;
  dirty: boolean;
}

interface StoredNote extends QuestionNote {
  localKey: string;
  dirty: boolean;
}

interface OverlayDb extends DBSchema {
  progress: {
    key: string;
    value: StoredProgress;
  };
  notes: {
    key: string;
    value: StoredNote;
  };
}

let dbPromise: Promise<IDBPDatabase<OverlayDb>> | null = null;

export async function upsertLocalProgress(progress: QuestionProgress): Promise<void> {
  const db = await getDb();
  const localKey = makeLocalKey(progress.source, progress.questionKey);
  const existing = await db.get('progress', localKey);

  if (existing && existing.updatedAt > progress.updatedAt) {
    return;
  }

  await db.put('progress', { ...progress, localKey, dirty: true });
}

export async function getLocalProgress(
  source: QuestionSource,
  questionKey: string
): Promise<QuestionProgress | null> {
  const db = await getDb();
  const record = await db.get('progress', makeLocalKey(source, questionKey));
  if (!record) return null;

  const { localKey: _localKey, dirty: _dirty, ...progress } = record;
  return progress;
}

export async function listDirtyProgress(): Promise<QuestionProgress[]> {
  const db = await getDb();
  const records = await db.getAll('progress');
  return records.filter((record) => record.dirty).map(({ localKey: _localKey, dirty: _dirty, ...progress }) => progress);
}

export async function markProgressSynced(source: QuestionSource, questionKey: string): Promise<void> {
  const db = await getDb();
  const localKey = makeLocalKey(source, questionKey);
  const record = await db.get('progress', localKey);
  if (!record) return;

  await db.put('progress', { ...record, dirty: false });
}

export async function upsertLocalNote(note: QuestionNote): Promise<void> {
  const db = await getDb();
  const localKey = makeLocalKey(note.source, note.questionKey);
  const existing = await db.get('notes', localKey);

  if (existing && existing.updatedAt > note.updatedAt) {
    return;
  }

  await db.put('notes', { ...note, localKey, dirty: true });
}

export async function getLocalNote(source: QuestionSource, questionKey: string): Promise<QuestionNote | null> {
  const db = await getDb();
  const record = await db.get('notes', makeLocalKey(source, questionKey));
  if (!record) return null;

  const { localKey: _localKey, dirty: _dirty, ...note } = record;
  return note;
}

export async function listDirtyNotes(): Promise<QuestionNote[]> {
  const db = await getDb();
  const records = await db.getAll('notes');
  return records.filter((record) => record.dirty).map(({ localKey: _localKey, dirty: _dirty, ...note }) => note);
}

export async function markNoteSynced(source: QuestionSource, questionKey: string): Promise<void> {
  const db = await getDb();
  const localKey = makeLocalKey(source, questionKey);
  const record = await db.get('notes', localKey);
  if (!record) return;

  await db.put('notes', { ...record, dirty: false });
}

export async function clearLocalDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }

  await deleteDB(DB_NAME);
}

function getDb(): Promise<IDBPDatabase<OverlayDb>> {
  dbPromise ??= openDB<OverlayDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('progress')) {
        db.createObjectStore('progress', { keyPath: 'localKey' });
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'localKey' });
      }
    }
  });
  return dbPromise;
}

function makeLocalKey(source: QuestionSource, questionKey: string): string {
  return `${source}:${questionKey}`;
}
