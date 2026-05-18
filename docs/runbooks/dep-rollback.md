# Dependency Rollback Runbook

**When to execute:** a TanStack-adjacent (or any other) npm package is reported compromised, or Socket.dev / `npm audit` flags an installed version as malicious.

## Severity 1 — actively malicious version in production

You're already on the bad version. Assume the worst: secrets reachable from the running app may be exposed.

### 1. Stop the bleeding (≤ 15 min)

- [ ] **Pause Vercel deployments** for the project (Project → Settings → General → Pause).
- [ ] **Rotate every secret the app holds**:
  - Supabase: regenerate `service_role` and `anon` keys.
  - Cloudflare R2: revoke API token, issue a new one.
  - Stripe/Midtrans/Xendit (if Phase 3+): rotate API keys + webhook secrets.
  - GitHub OAuth client secret (if used for auth).
- [ ] Update Vercel env vars + redeploy *with the new secrets* once we've rolled back deps (next step).

### 2. Roll back the dependency (≤ 30 min)

- [ ] `git log -- package-lock.json` — find the last known-good lockfile commit.
- [ ] Create branch: `git switch -c rollback/<pkg>-<date>`.
- [ ] `git checkout <good-sha> -- package-lock.json package.json` (both — they move together).
- [ ] `rm -rf node_modules`.
- [ ] `npm ci --ignore-scripts`.
- [ ] `bash scripts/verify-deps.sh` — must pass.
- [ ] `npm rebuild esbuild @prisma/engines sharp` (only the allow-list of trusted post-install scripts).
- [ ] PR → review → merge → redeploy.

### 3. Audit (≤ 24 h)

- [ ] Pull Vercel function logs for the suspected exposure window. Look for unexpected outbound calls (anything not Supabase / R2 / our CDN / analytics).
- [ ] Pull Supabase audit logs (Dashboard → Logs → API). Look for unusual queries from your service role.
- [ ] Pull Cloudflare R2 access logs. Look for unfamiliar IPs or unusual object reads.
- [ ] If exfiltration is found, file a security incident report; notify users only if their data was provably accessed.

## Severity 2 — bad version published but we never installed it

Lockfile + exact-pinning saved us. No rollback needed.

- [ ] Add the bad package + version to the `BAD_NAMES_REGEX` in `scripts/verify-deps.sh`.
- [ ] Open a tracking issue with the advisory link.
- [ ] When upgrading past the bad version, document the chosen good version in the PR.

## Severity 3 — Socket.dev / Dependabot flagged a transitive dep

- [ ] Open Socket.dev report → identify the offending package + the path through which we depend on it.
- [ ] If the direct dep has a patched version available: bump (respect §16 cooling-off unless it's a security fix).
- [ ] If not: use `overrides` in `package.json` to pin the transitive to a clean version, document in the PR, file upstream issue.

## Prevention reminders (post-incident)

- Was the bad version inside the 7-day cooling-off window? If yes, the system worked — record it. If no, tighten the cooling-off or add monitoring.
- Did `verify-deps.sh` have a chance to catch it? If yes but it didn't, harden the script.
- Did Socket.dev / Dependabot flag it before we noticed? If no, evaluate whether a different tool would have.
