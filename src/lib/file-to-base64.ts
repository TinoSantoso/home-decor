/**
 * Encode a Blob/File to a raw base64 string (no `data:…;base64,` prefix) for
 * transport through the TanStack server-fn JSON-RPC channel, which cannot
 * carry binary `Uint8Array`/`Buffer` payloads.
 *
 * Chunked to avoid blowing the JS engine's argument-list limit on
 * `String.fromCharCode(...)` for files larger than ~250 KiB.
 */
export async function fileToBase64(blob: Blob): Promise<string> {
  if (blob.size === 0) throw new Error('Cannot encode empty blob');

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(
      null,
      slice as unknown as number[],
    );
  }
  return btoa(binary);
}
