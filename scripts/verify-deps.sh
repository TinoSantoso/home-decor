#!/usr/bin/env bash
# Supply-chain verification — plan §16.
# Runs in CI and pre-merge. Fails fast on any signal of trouble.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Verifying lockfile presence"
test -f package-lock.json || { echo "FAIL: package-lock.json missing"; exit 1; }

echo "==> Verifying .npmrc enforces ignore-scripts"
grep -q "^ignore-scripts=true" .npmrc || { echo "FAIL: .npmrc missing ignore-scripts=true"; exit 1; }

echo "==> npm ci --ignore-scripts (clean install from lockfile)"
npm ci --ignore-scripts

echo "==> npm audit signatures (registry provenance)"
npm audit signatures

echo "==> npm audit (high+ severity blocks merge)"
npm audit --audit-level=high --omit=dev || {
  echo "FAIL: high-severity vulnerability in production deps";
  exit 1;
}

echo "==> Grep lockfile for known-bad package names"
# Append to this list when an incident is reported. One regex per line, # for comments.
BAD_NAMES_REGEX='(^|/)(node-ipc|colors|faker)@'
if grep -E "$BAD_NAMES_REGEX" package-lock.json >/dev/null; then
  echo "FAIL: known-compromised package present in lockfile"
  exit 1
fi

echo "==> Verifying all TanStack deps are exact-pinned (no ^ or ~)"
node -e '
  const pkg = JSON.parse(require("fs").readFileSync("package.json", "utf8"));
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const bad = Object.entries(all).filter(([name, v]) =>
    name.startsWith("@tanstack/") && /^[~^]/.test(v)
  );
  if (bad.length) {
    console.error("FAIL: non-exact TanStack pins:", bad);
    process.exit(1);
  }
'

echo "OK: dependency verification passed."
