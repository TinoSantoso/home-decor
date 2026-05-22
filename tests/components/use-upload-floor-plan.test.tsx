// @vitest-environment happy-dom

/**
 * TDD: useUploadFloorPlan hook.
 *
 * The hook owns the client side of the floor-plan reference upload flow:
 * encode the File to base64, POST through the TanStack server-fn wrapper
 * (mocked here), and surface { status, error, url } for the UI.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// Mock the server fn module BEFORE importing the hook. vi.mock is hoisted.
vi.mock('../../src/server/upload-asset', () => ({
  uploadAssetFn: vi.fn(),
}));

// Import the mocked function so we can configure return values per-test.
import { uploadAssetFn } from '../../src/server/upload-asset';
import { useUploadFloorPlan } from '../../src/components/editor/use-upload-floor-plan';

const mockUploadAssetFn = vi.mocked(uploadAssetFn);

function pngFile(): File {
  // Tiny 5-byte payload — enough for the chunked-encode path.
  return new File(['hello'], 'sketch.png', { type: 'image/png' });
}

beforeEach(() => {
  mockUploadAssetFn.mockReset();
});

afterEach(() => {
  mockUploadAssetFn.mockReset();
});

describe('useUploadFloorPlan', () => {
  it('starts in the idle state with no url or error', () => {
    const { result } = renderHook(() => useUploadFloorPlan('proj-abc'));
    expect(result.current.status).toBe('idle');
    expect(result.current.url).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('transitions idle → uploading → success and exposes the URL', async () => {
    mockUploadAssetFn.mockResolvedValueOnce({
      ok: true,
      key: 'floor-plans/proj-abc/whatever.png',
      url: 'https://assets.example.com/floor-plans/proj-abc/whatever.png',
    });

    const { result } = renderHook(() => useUploadFloorPlan('proj-abc'));
    await act(async () => {
      await result.current.upload(pngFile());
    });

    expect(result.current.status).toBe('success');
    expect(result.current.url).toBe(
      'https://assets.example.com/floor-plans/proj-abc/whatever.png',
    );
    expect(result.current.error).toBeNull();
  });

  it('shows uploading status while the server-fn call is in flight', async () => {
    let resolveFn: (v: {
      ok: true;
      key: string;
      url: string;
    }) => void = () => {};
    const pending = new Promise<{ ok: true; key: string; url: string }>(
      (resolve) => {
        resolveFn = resolve;
      },
    );
    mockUploadAssetFn.mockReturnValueOnce(pending);

    const { result } = renderHook(() => useUploadFloorPlan('proj-abc'));

    // Start the upload but don't await — we want to observe the in-flight state.
    let uploadPromise!: Promise<void>;
    act(() => {
      uploadPromise = result.current.upload(pngFile());
    });

    await waitFor(() => expect(result.current.status).toBe('uploading'));

    await act(async () => {
      resolveFn({
        ok: true,
        key: 'floor-plans/proj-abc/x.png',
        url: 'https://assets.example.com/floor-plans/proj-abc/x.png',
      });
      await uploadPromise;
    });

    expect(result.current.status).toBe('success');
  });

  it('sends key namespaced by projectId, file extension, and the inferred contentType', async () => {
    mockUploadAssetFn.mockResolvedValueOnce({
      ok: true,
      key: 'placeholder',
      url: 'https://assets.example.com/placeholder',
    });

    const { result } = renderHook(() => useUploadFloorPlan('proj-xyz'));
    await act(async () => {
      await result.current.upload(
        new File(['data'], 'My Plan.JPG', { type: 'image/jpeg' }),
      );
    });

    expect(mockUploadAssetFn).toHaveBeenCalledTimes(1);
    const callArg = mockUploadAssetFn.mock.calls[0]![0] as {
      data: { key: string; contentType: string; bodyBase64: string };
    };
    expect(callArg.data.contentType).toBe('image/jpeg');
    expect(callArg.data.key).toMatch(/^floor-plans\/proj-xyz\/.+\.jpg$/);
    // bodyBase64 should be raw base64 (no data: prefix) for the bytes "data".
    expect(callArg.data.bodyBase64).toBe('ZGF0YQ==');
  });

  it('transitions to error on a server-fn rejection and surfaces the message', async () => {
    mockUploadAssetFn.mockRejectedValueOnce(new Error('R2 down'));

    const { result } = renderHook(() => useUploadFloorPlan('proj-abc'));
    await act(async () => {
      await result.current.upload(pngFile());
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/r2 down/i);
    expect(result.current.url).toBeNull();
  });

  it('transitions to error when the file is empty (fileToBase64 rejects)', async () => {
    const empty = new File([], 'empty.png', { type: 'image/png' });

    const { result } = renderHook(() => useUploadFloorPlan('proj-abc'));
    await act(async () => {
      await result.current.upload(empty);
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toMatch(/empty/i);
    // Server fn should not have been called at all when the encode rejects.
    expect(mockUploadAssetFn).not.toHaveBeenCalled();
  });

  it('reset() clears status, url, and error back to initial', async () => {
    mockUploadAssetFn.mockResolvedValueOnce({
      ok: true,
      key: 'k',
      url: 'https://assets.example.com/k',
    });

    const { result } = renderHook(() => useUploadFloorPlan('proj-abc'));
    await act(async () => {
      await result.current.upload(pngFile());
    });
    expect(result.current.status).toBe('success');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.url).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
