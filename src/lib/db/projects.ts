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
    floorPlanImageUrl: null,
    shareToken: null,
    shareTokenExpiry: null,
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
 * Backwards-compatible record migration: older records may lack newer fields,
 * so we default each one here rather than running a formal IDB migration.
 */
function hydrate(record: ProjectRecord | undefined): ProjectRecord | null {
  if (!record) return null;
  return {
    ...record,
    placedItems: record.placedItems ?? [],
    styleTag: record.styleTag ?? null,
    floorPlanImageUrl: record.floorPlanImageUrl ?? null,
    shareToken: record.shareToken ?? null,
    shareTokenExpiry: record.shareTokenExpiry ?? null,
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

/** 30-day expiry in milliseconds */
const SHARE_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generate a new share token for a project. Overwrites any existing token.
 * Returns the token and sets expiry to 30 days from now.
 */
export async function generateShareToken(id: string): Promise<string | null> {
  const db = await getDb();
  const record = await db.get('projects', id);
  if (!record) return null;

  const token = nanoid(16);
  const expiry = Date.now() + SHARE_TOKEN_TTL_MS;

  const updated = hydrate(record)!;
  updated.shareToken = token;
  updated.shareTokenExpiry = expiry;
  updated.updatedAt = Date.now();

  await db.put('projects', updated);
  return token;
}

/**
 * Get the current share token and expiry for a project.
 */
export async function getShareToken(
  id: string,
): Promise<{ token: string; expiry: number } | null> {
  const record = await getProject(id);
  if (!record?.shareToken || !record?.shareTokenExpiry) return null;
  return { token: record.shareToken, expiry: record.shareTokenExpiry };
}

/**
 * Revoke the share token for a project (e.g., on explicit user action).
 */
export async function revokeShareToken(id: string): Promise<void> {
  const db = await getDb();
  const record = await db.get('projects', id);
  if (!record) return;

  const updated = hydrate(record)!;
  updated.shareToken = null;
  updated.shareTokenExpiry = null;
  updated.updatedAt = Date.now();

  await db.put('projects', updated);
}

/**
 * Check if a token is valid (exists on the project and not expired).
 */
export async function isShareTokenValid(
  projectId: string,
  token: string,
): Promise<boolean> {
  const record = await getProject(projectId);
  if (!record?.shareToken || !record?.shareTokenExpiry) return false;
  if (record.shareToken !== token) return false;
  return Date.now() < record.shareTokenExpiry;
}
