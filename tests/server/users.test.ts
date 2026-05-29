import { describe, expect, it, vi } from 'vitest';
import { createUserService, type UserDb } from '../../src/server/users';

function db(): UserDb {
  return {
    user: {
      upsert: vi.fn().mockResolvedValue({
        id: 'auth-user-1',
        email: 'u@example.com',
      }),
    },
  };
}

describe('createUserService', () => {
  it('upserts a Prisma user using the Supabase auth user id', async () => {
    const mockDb = db();
    const service = createUserService(mockDb);

    await service.ensureUser({ id: 'auth-user-1', email: 'u@example.com' });

    expect(mockDb.user.upsert).toHaveBeenCalledWith({
      where: { id: 'auth-user-1' },
      create: { id: 'auth-user-1', email: 'u@example.com' },
      update: { email: 'u@example.com' },
    });
  });
});
