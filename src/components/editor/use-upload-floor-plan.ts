/**
 * Client hook that drives the floor-plan reference upload flow:
 *   File → base64 → uploadAssetFn (TanStack server fn) → R2 → public URL.
 *
 * The hook owns nothing more than the in-flight async state machine; the
 * caller decides what to do with the resulting URL (e.g. write it back into
 * the Zustand store so IDB auto-save picks it up).
 */
import { useCallback, useState } from 'react';
import { nanoid } from 'nanoid';
import { uploadAssetFn } from '../../server/upload-asset';
import { fileToBase64 } from '../../lib/file-to-base64';

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface UseUploadFloorPlanResult {
  upload: (file: File) => Promise<void>;
  status: UploadStatus;
  error: string | null;
  url: string | null;
  reset: () => void;
}

export function useUploadFloorPlan(
  projectId: string,
): UseUploadFloorPlanResult {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setStatus('uploading');
      setError(null);
      try {
        const bodyBase64 = await fileToBase64(file);
        const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
        const key = `floor-plans/${projectId}/${nanoid(10)}.${ext}`;
        const contentType = file.type || 'application/octet-stream';

        const result = await uploadAssetFn({
          data: { key, contentType, bodyBase64 },
        });
        setUrl(result.url);
        setStatus('success');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    },
    [projectId],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setUrl(null);
  }, []);

  return { upload, status, error, url, reset };
}
