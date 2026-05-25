import { describe, expect, it } from 'vitest';
import { parseCookies } from '../../src/lib/supabase/server';

describe('parseCookies', () => {
  it('parses cookie header pairs', () => {
    expect(parseCookies('sb-access-token=abc; locale=id')).toEqual({
      'sb-access-token': 'abc',
      locale: 'id',
    });
  });

  it('keeps raw value when decoding fails', () => {
    expect(parseCookies('bad=%E0%A4%A')).toEqual({ bad: '%E0%A4%A' });
  });

  it('ignores malformed chunks', () => {
    expect(parseCookies('valid=1; invalid; another=2')).toEqual({
      valid: '1',
      another: '2',
    });
  });
});
