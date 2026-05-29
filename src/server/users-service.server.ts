import { createRequire } from 'node:module';
import { createUserService, type UserDb, type UserService } from './users';

const nodeRequire = createRequire(import.meta.url);
let defaultDb: UserDb | null = null;

function getDefaultDb(): UserDb {
  if (defaultDb) return defaultDb;
  const { PrismaClient } = nodeRequire('@prisma/client') as {
    PrismaClient: new () => UserDb;
  };
  defaultDb = new PrismaClient();
  return defaultDb;
}

export function getUserService(): UserService {
  return createUserService(getDefaultDb());
}
