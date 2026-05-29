import { createRequire } from 'node:module';
import { createProjectService, type ProjectDb, type ProjectService } from './projects';

const nodeRequire = createRequire(import.meta.url);
let defaultDb: ProjectDb | null = null;

function getDefaultDb(): ProjectDb {
  if (defaultDb) return defaultDb;
  const { PrismaClient } = nodeRequire('@prisma/client') as {
    PrismaClient: new () => ProjectDb;
  };
  defaultDb = new PrismaClient();
  return defaultDb;
}

export function getProjectService(): ProjectService {
  return createProjectService(getDefaultDb());
}
