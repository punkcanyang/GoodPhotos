#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"
ALLOWLIST_FILE="$ROOT_DIR/docs/dual-repo/secret-scan-allowlist.regex"

FAILED=0

echo "[guard] scanning forbidden private-backend directories..."
FORBIDDEN_DIRS=(
  "goodphotos-billing-backend"
  "billing-backend"
  "backend-private"
)

for dir in "${FORBIDDEN_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    echo "[guard][error] forbidden directory found in public repo: $dir"
    FAILED=1
  fi
done

echo "[guard] scanning potential secrets..."
RAW_MATCHES="$(rg -n --hidden \
  --glob '!.git' \
  --glob '!node_modules' \
  --glob '!dist' \
  --glob '!dist-ssr' \
  -e 'sk_live_[0-9A-Za-z]{16,}' \
  -e 'whsec_[0-9A-Za-z]{16,}' \
  -e 'postgres(ql)?://[^[:space:]]+' \
  -e '(DATABASE_URL|POSTGRES_URL|POSTGRESQL_URL)[[:space:]]*[:=][[:space:]]*[^[:space:]]{8,}' \
  -e '(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_API_KEY)[[:space:]]*[:=][[:space:]]*[^[:space:]]{8,}' \
  -e '(JWT_SECRET|JWT_PRIVATE_KEY|JWT_SIGNING_KEY)[[:space:]]*[:=][[:space:]]*[^[:space:]]{8,}' \
  -e '-----BEGIN[[:space:]]+[^-]+PRIVATE KEY-----' \
  . || true)"

MATCHES="$RAW_MATCHES"
if [[ -f "$ALLOWLIST_FILE" ]]; then
  FILTER_FILE="$(mktemp)"
  grep -Ev '^[[:space:]]*(#|$)' "$ALLOWLIST_FILE" > "$FILTER_FILE" || true
  if [[ -s "$FILTER_FILE" && -n "$RAW_MATCHES" ]]; then
    MATCHES="$(printf '%s\n' "$RAW_MATCHES" | grep -Ev -f "$FILTER_FILE" || true)"
  fi
  rm -f "$FILTER_FILE"
fi

if [[ -n "$MATCHES" ]]; then
  echo "[guard][error] possible secret detected:"
  echo "$MATCHES"
  echo "[guard][hint] if any line is expected, add an allowlist regex to: $ALLOWLIST_FILE"
  FAILED=1
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "[guard] failed"
  exit 1
fi

echo "[guard] passed"
