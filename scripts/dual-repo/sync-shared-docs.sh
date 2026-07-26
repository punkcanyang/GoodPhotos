#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_DIR="$ROOT_DIR/docs/dual-repo/shared"
EXPECTED_REPO_ROLE="billing-backend"
REPO_ROLE_MARKER=".goodphotos-repo-role"

TARGET_REPO_PATH="${1:-}"
if [[ -z "$TARGET_REPO_PATH" ]]; then
  echo "Usage: npm run sync:shared-docs -- /absolute/path/to/goodphotos-billing-backend"
  exit 1
fi

if [[ ! -d "$TARGET_REPO_PATH" ]]; then
  echo "Target repo path not found: $TARGET_REPO_PATH"
  exit 1
fi

TARGET_REPO_PATH="$(cd "$TARGET_REPO_PATH" && pwd)"
if [[ "$TARGET_REPO_PATH" == "$ROOT_DIR" ]]; then
  echo "Refuse to sync to current public repo: $TARGET_REPO_PATH"
  exit 1
fi

if ! git -C "$TARGET_REPO_PATH" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Target path is not a git repository: $TARGET_REPO_PATH"
  exit 1
fi

MARKER_FILE="$TARGET_REPO_PATH/$REPO_ROLE_MARKER"
if [[ ! -f "$MARKER_FILE" ]]; then
  echo "Missing repo role marker: $MARKER_FILE"
  echo "Create it with exactly this content: $EXPECTED_REPO_ROLE"
  exit 1
fi

TARGET_REPO_ROLE="$(tr -d '[:space:]' < "$MARKER_FILE")"
if [[ "$TARGET_REPO_ROLE" != "$EXPECTED_REPO_ROLE" ]]; then
  echo "Unexpected repo role in $MARKER_FILE: '$TARGET_REPO_ROLE'"
  echo "Expected: '$EXPECTED_REPO_ROLE'"
  exit 1
fi

TARGET_DIR="$TARGET_REPO_PATH/docs/dual-repo/shared"
mkdir -p "$TARGET_DIR"

cp "$SOURCE_DIR/ARCHITECTURE.md" "$TARGET_DIR/ARCHITECTURE.md"
cp "$SOURCE_DIR/API-CONTRACT.md" "$TARGET_DIR/API-CONTRACT.md"

echo "Synced shared docs to: $TARGET_DIR"
