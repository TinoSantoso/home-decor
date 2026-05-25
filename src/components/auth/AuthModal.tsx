import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthStore } from '../../stores/auth';

/** Props for the AuthModal. open / onOpenChange let the parent control visibility. */
export interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the email field (e.g. after a guarded-route redirect). */
  initialEmail?: string;
}

/**
 * Authentication modal — email magic link + Google OAuth.
 *
 * - Email mode: type email → "Kirim Tautan" → shows "Cek email Anda" confirmation.
 * - Google mode: one-click redirect via OAuth.
 * - Closes when the user is authenticated (session is set).
 */
export function AuthModal({
  open,
  onOpenChange,
  initialEmail,
}: AuthModalProps) {
  const { t } = useTranslation();
  const { signInWithEmail, signInWithGoogle, isAuthenticated } = useAuthStore();

  const [mode, setMode] = useState<'email' | 'google'>('email');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>(
    'idle',
  );
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when the modal opens.
  useEffect(() => {
    if (open && mode === 'email') {
      // Small tick so Radix finishes animating in first.
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, mode]);

  // Close the modal if the user becomes authenticated while it's open.
  useEffect(() => {
    if (isAuthenticated) onOpenChange(false);
  }, [isAuthenticated, onOpenChange]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    const { error } = await signInWithEmail(email.trim());
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
    } else {
      setStatus('sent');
    }
  }

  async function handleGoogle() {
    await signInWithGoogle();
  }

  const handleOpenChange = (next: boolean) => {
    // Reset state on close so re-opening feels fresh.
    if (!next) {
      setStatus('idle');
      setErrorMessage('');
    }
    onOpenChange(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          aria-describedby="auth-modal-description"
        >
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                {t('auth.modalTitle')}
              </Dialog.Title>
              <Dialog.Description
                id="auth-modal-description"
                className="mt-1 text-sm text-[color:var(--color-text-muted)]"
              >
                {mode === 'email'
                  ? t('auth.emailDescription')
                  : t('auth.googleDescription')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t('auth.close')}
              className="rounded-[var(--radius-sm)] p-1.5 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-border)] hover:text-[color:var(--color-text)]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Dialog.Close>
          </div>

          {/* Mode switcher */}
          <div className="mb-4 flex rounded-[var(--radius)] border border-[color:var(--color-border)] p-0.5">
            <button
              type="button"
              onClick={() => {
                setMode('email');
                setStatus('idle');
                setErrorMessage('');
              }}
              className={`flex-1 rounded-[calc(var(--radius)-2px)] px-3 py-1.5 text-sm font-medium transition-colors ${mode === 'email' ? 'bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]' : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'}`}
            >
              {t('auth.tabEmail')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('google');
                setStatus('idle');
                setErrorMessage('');
              }}
              className={`flex-1 rounded-[calc(var(--radius)-2px)] px-3 py-1.5 text-sm font-medium transition-colors ${mode === 'google' ? 'bg-[color:var(--color-accent)] text-[color:var(--color-accent-fg)]' : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]'}`}
            >
              {t('auth.tabGoogle')}
            </button>
          </div>

          {/* Email form */}
          {mode === 'email' && status !== 'sent' && (
            <form
              onSubmit={(e) => void handleEmailSubmit(e)}
              className="space-y-3"
            >
              <div>
                <label
                  htmlFor="auth-email"
                  className="mb-1 block text-sm font-medium"
                >
                  {t('auth.emailLabel')}
                </label>
                <input
                  ref={inputRef}
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@contoh.com"
                  required
                  autoComplete="email"
                  disabled={status === 'loading'}
                  className="w-full rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {status === 'error' && (
                <p
                  role="alert"
                  className="text-xs text-[color:var(--color-danger)]"
                >
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'loading' || !email.trim()}
                className="w-full rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-[color:var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'loading'
                  ? t('auth.sending')
                  : t('auth.sendMagicLink')}
              </button>
            </form>
          )}

          {/* Sent confirmation */}
          {mode === 'email' && status === 'sent' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-success)]/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-[color:var(--color-success)]"
                  aria-hidden="true"
                >
                  <path
                    d="M5 13l4 4L19 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">{t('auth.sentTitle')}</p>
                <p className="mt-1 text-sm text-[color:var(--color-text-muted)]">
                  {t('auth.sentBody', { email })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStatus('idle');
                  setEmail('');
                }}
                className="text-sm text-[color:var(--color-accent)] hover:underline"
              >
                {t('auth.tryAgain')}
              </button>
            </div>
          )}

          {/* Google */}
          {mode === 'google' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => void handleGoogle()}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--color-border)]"
              >
                {/* Google logo SVG */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  aria-hidden="true"
                >
                  <path
                    d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                    fill="#4285F4"
                  />
                  <path
                    d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
                    fill="#34A853"
                  />
                  <path
                    d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                    fill="#EA4335"
                  />
                </svg>
                {t('auth.continueWithGoogle')}
              </button>
              <p className="text-center text-xs text-[color:var(--color-text-muted)]">
                {t('auth.termsNotice')}
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
