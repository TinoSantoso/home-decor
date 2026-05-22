import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFloorPlan } from '../../stores/floor-plan';
import { useUploadFloorPlan } from './use-upload-floor-plan';

export function FloorPlanUploader() {
  const { t } = useTranslation();
  const projectId = useFloorPlan((s) => s.projectId);
  const floorPlanImageUrl = useFloorPlan((s) => s.floorPlanImageUrl);
  const setFloorPlanImageUrl = useFloorPlan((s) => s.setFloorPlanImageUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const { upload, status, error, url } = useUploadFloorPlan(projectId ?? '');

  useEffect(() => {
    if (status === 'success' && url) {
      setFloorPlanImageUrl(url);
    }
  }, [status, url, setFloorPlanImageUrl]);

  if (!projectId) return null;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    // Clear so the same filename can be picked again.
    e.target.value = '';
  };

  const isUploading = status === 'uploading';
  const buttonClass =
    'rounded-[var(--radius-sm)] border border-[color:var(--color-border)] px-2 py-1 text-xs hover:border-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <section
      aria-label={t('editor.floorPlanReference')}
      className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
        data-testid="floor-plan-file-input"
        aria-label={t('editor.uploadReference')}
      />

      <span className="text-sm font-medium text-[color:var(--color-text-muted)]">
        {t('editor.floorPlanReference')}:
      </span>

      {floorPlanImageUrl ? (
        <>
          <img
            src={floorPlanImageUrl}
            alt=""
            className="h-10 w-16 rounded-[var(--radius-sm)] border border-[color:var(--color-border)] object-cover"
            data-testid="floor-plan-image"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className={buttonClass}
          >
            {isUploading ? t('editor.uploading') : t('editor.replaceReference')}
          </button>
          <button
            type="button"
            onClick={() => setFloorPlanImageUrl(null)}
            disabled={isUploading}
            className={buttonClass}
          >
            {t('editor.removeReference')}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={buttonClass}
        >
          {isUploading ? t('editor.uploading') : t('editor.uploadReference')}
        </button>
      )}

      {status === 'error' && error && (
        <span
          role="alert"
          className="text-xs text-[color:var(--color-danger)]"
        >
          {t('editor.uploadFailed')}: {error}
        </span>
      )}
    </section>
  );
}
