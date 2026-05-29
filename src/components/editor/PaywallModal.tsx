import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthStore } from '../../stores/auth';

/** Which CTA variant to show in the modal. */
export type UserPaywallStatus =
  | 'unauthenticated'
  | 'authenticated_no_credits'
  | 'paying_user';

export interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Drives which content variant is shown. */
  userStatus: UserPaywallStatus;
  /** Called when the user clicks "Choose a Plan". In a real app this opens a pricing page. */
  onUpgrade?: () => void;
  upgradeLoading?: boolean;
  upgradeError?: string | null;
  /** Optional close label override (used by the share route to say "Maybe Later"). */
  closeLabel?: string;
}

/**
 * Upsell / credit-exhausted modal.
 *
 * Three content variants based on `userStatus`:
 *   - unauthenticated: shows email + Google sign-in to earn free credits
 *   - authenticated_no_credits: shows upgrade CTA
 *   - paying_user: fatal "limit reached" with no actionable CTA
 */
export function PaywallModal({
  open,
  onOpenChange,
  userStatus,
  onUpgrade,
  upgradeLoading = false,
  upgradeError = null,
  closeLabel,
}: PaywallModalProps) {
  const { t } = useTranslation();
  const { signInWithEmail, signInWithGoogle, isAuthenticated } = useAuthStore();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus email input when the modal opens (unauthenticated variant).
  useEffect(() => {
    if (open && userStatus === 'unauthenticated') {
      const tid = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(tid);
    }
  }, [open, userStatus]);

  // Close automatically if the user completes auth while the modal is open.
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
    if (!next) {
      setStatus('idle');
      setErrorMessage('');
      setEmail('');
    }
    onOpenChange(next);
  };

  const closeBtnLabel = closeLabel ?? t('paywall.ctaClose');

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          aria-describedby="paywall-modal-description"
        >
          {/* Header */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                {userStatus === 'unauthenticated'
                  ? t('paywall.freeCreditsTitle', { credits: 5 })
                  : userStatus === 'authenticated_no_credits'
                    ? t('paywall.title')
                    : t('paywall.payingUserTitle')}
              </Dialog.Title>
              <Dialog.Description
                id="paywall-modal-description"
                className="mt-1 text-sm text-[color:var(--color-text-muted)]"
              >
                {userStatus === 'unauthenticated'
                  ? t('paywall.freeCreditsBody', { credits: 5 })
                  : userStatus === 'authenticated_no_credits'
                    ? t('paywall.body', { credits: 5 })
                    : t('paywall.payingUserBody')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={closeBtnLabel}
              className="rounded-[var(--radius-sm)] p-1.5 text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-border)] hover:text-[color:var(--color-text)] shrink-0"
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

          {/* Unauthenticated: email + Google auth */}
          {userStatus === 'unauthenticated' && status !== 'sent' && (
            <div className="space-y-4">
              {/* Email form */}
              <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3">
                <div>
                  <label
                    htmlFor="paywall-email"
                    className="mb-1 block text-sm font-medium"
                  >
                    {t('auth.emailLabel')}
                  </label>
                  <input
                    ref={inputRef}
                    id="paywall-email"
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
                  <p role="alert" className="text-xs text-[color:var(--color-danger)]">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading' || !email.trim()}
                  className="w-full rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-[color:var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === 'loading' ? t('auth.sending') : t('auth.sendMagicLink')}
                </button>
              </form>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[color:var(--color-border)]" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[color:var(--color-surface)] px-2 text-xs text-[color:var(--color-text-muted)]">
                    atau
                  </span>
                </div>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={() => void handleGoogle()}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--color-border)]"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                  <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                </svg>
                {t('auth.continueWithGoogle')}
              </button>
            </div>
          )}

          {/* Unauthenticated: sent confirmation */}
          {userStatus === 'unauthenticated' && status === 'sent' && (
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
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

          {/* Authenticated but no credits: upgrade CTA */}
          {userStatus === 'authenticated_no_credits' && (
            <div className="space-y-4">
              {/* Feature list */}
              <ul className="space-y-2">
                {[
                  t('paywall.features.unlimitedExports'),
                  t('paywall.features.unlimitedProjects'),
                  t('paywall.features.unlimitedShare'),
                ].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[color:var(--color-success)] shrink-0" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {upgradeError && (
                <p role="alert" className="text-xs text-[color:var(--color-danger)]">
                  {upgradeError}
                </p>
              )}

              <button
                type="button"
                disabled={upgradeLoading}
                onClick={onUpgrade}
                className="w-full rounded-[var(--radius)] bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-medium text-[color:var(--color-accent-fg)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {upgradeLoading ? t('paywall.checkoutStarting') : t('paywall.ctaUpgrade')}
              </button>
            </div>
          )}

          {/* Paying user: limit reached, no CTA */}
          {userStatus === 'paying_user' && (
            <p className="text-center text-sm text-[color:var(--color-text-muted)]">
              {t('paywall.payingUserBody')}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
