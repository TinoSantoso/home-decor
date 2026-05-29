import { describe, expect, it } from 'vitest';
import { loadSessionFromCookies } from '../../src/stores/auth';

describe('auth store without Supabase browser env', () => {
  it('hydrates as signed out instead of throwing', async () => {
    await expect(loadSessionFromCookies()).resolves.toBeNull();
  });
});
