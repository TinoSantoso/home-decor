import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProjectRecord } from './types';

interface HdtSchema extends DBSchema {
  projects: {
    key: string;
    value: ProjectRecord;
    indexes: { 'by-updatedAt': number };
  };
}

const DB_NAME = 'hdt';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HdtSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<HdtSchema>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('IndexedDB is not available in this environment'),
    );
  }
  if (!dbPromise) {
    dbPromise = openDB<HdtSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('by-updatedAt', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}
