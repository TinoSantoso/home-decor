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
    zones: [],
    createdAt: now,
    updatedAt: now,
  };
  const db = await getDb();
  await db.put('projects', record);
  return record;
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const db = await getDb();
  const record = await db.get('projects', id);
  return record ?? null;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const db = await getDb();
  const records = await db.getAllFromIndex('projects', 'by-updatedAt');
  return records.reverse();
}

export async function saveProject(record: ProjectRecord): Promise<void> {
  const db = await getDb();
  await db.put('projects', { ...record, updatedAt: Date.now() });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('projects', id);
}
