export interface UserRecord {
  id: string;
  email: string;
}

interface UserModel {
  upsert(args: Record<string, unknown>): Promise<UserRecord>;
}

export interface UserDb {
  user: UserModel;
}

export interface AuthUserIdentity {
  id: string;
  email?: string | null;
}

export interface UserService {
  ensureUser(user: AuthUserIdentity): Promise<UserRecord>;
}

export function createUserService(db: UserDb): UserService {
  return {
    ensureUser(user) {
      const email = user.email ?? `${user.id}@supabase.local`;
      return db.user.upsert({
        where: { id: user.id },
        create: { id: user.id, email },
        update: { email },
      });
    },
  };
}

export async function ensureUser(user: AuthUserIdentity): Promise<UserRecord> {
  const { getUserService } = await import('./users-service.server');
  return getUserService().ensureUser(user);
}
