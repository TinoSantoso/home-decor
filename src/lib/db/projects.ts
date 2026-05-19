import { nanoid } from 'nanoid';
import { getDb } from './idb';
import type { NewProjectInput, ProjectRecord } from './types';

export async function createProject(
  input: NewProjectInput,
): Promise<ProjectRecord> {
  const now = Date.now();
  const record: ProjectRecord = {
    id: nanoid(8),
    ...input,
    styleTag: null,
    zones: [],
    placedItems: [],
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDb();
  await db.put('projects', record);
  return record;
}

/**
 * Backwards-compatible record migration: pre-v2 records lack `placedItems`,
 * so we default it to `[]` here rather than running a formal IDB migration.
 */
function hydrate(record: ProjectRecord | undefined): ProjectRecord | null {
  if (!record) return null;
  return {
    ...record,
    placedItems: record.placedItems ?? [],
    styleTag: record.styleTag ?? null,
  };
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const db = await getDb();
  const record = await db.get('projects', id);
  return hydrate(record);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await getDb();
  const records = await db.getAllFromIndex('projects', 'by-updatedAt');
  return records.reverse().map((r) => hydrate(r)!);
}

export async function saveProject(record: ProjectRecord): Promise<void> {
  const db = await getDb();
  await db.put('projects', { ...record, updatedAt: Date.now() });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('projects', id);
}
