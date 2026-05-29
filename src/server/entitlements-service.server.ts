import { createRequire } from 'node:module';
import {
  createEntitlementService,
  type EntitlementDb,
  type EntitlementService,
} from './entitlements';

const nodeRequire = createRequire(import.meta.url);
let defaultDb: EntitlementDb | null = null;

function getDefaultDb(): EntitlementDb {
  if (defaultDb) return defaultDb;
  const { PrismaClient } = nodeRequire('@prisma/client') as {
    PrismaClient: new () => EntitlementDb;
  };
  defaultDb = new PrismaClient();
  return defaultDb;
}

export function getEntitlementService(): EntitlementService {
  return createEntitlementService(getDefaultDb());
}
