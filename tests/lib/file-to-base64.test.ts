import { describe, expect, it } from 'vitest';
import { fileToBase64 } from '../../src/lib/file-to-base64';

describe('fileToBase64', () => {
  it('encodes a small blob to raw base64 (no data: URI prefix)', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const b64 = await fileToBase64(blob);
    // "hello" → base64 = "aGVsbG8=" — assert raw, not "data:text/plain;base64,…".
    expect(b64).toBe('aGVsbG8=');
  });

  it('round-trips arbitrary binary bytes', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 255]);
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const b64 = await fileToBase64(blob);
    // Decode back and confirm byte-for-byte equality.
    const decoded = Uint8Array.from(Buffer.from(b64, 'base64'));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it('rejects an empty blob', async () => {
    const blob = new Blob([], { type: 'image/png' });
    await expect(fileToBase64(blob)).rejects.toThrow(/empty/i);
  });

  it('handles a blob larger than the chunk threshold (32 KiB)', async () => {
    // Build 40 KiB of deterministic data so we exercise the chunking loop.
    const size = 40 * 1024;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) bytes[i] = i & 0xff;
    const blob = new Blob([bytes]);

    const b64 = await fileToBase64(blob);

    const decoded = Uint8Array.from(Buffer.from(b64, 'base64'));
    expect(decoded.length).toBe(size);
    expect(decoded[0]).toBe(0);
    expect(decoded[255]).toBe(255);
    expect(decoded[size - 1]).toBe((size - 1) & 0xff);
  });
});
