#!/usr/bin/env bash

set -euo pipefail

ASSETS_DIR="${1:-}"
EXPECTED_TAG="${2:-}"

if [[ ! -d "$ASSETS_DIR" || -z "$EXPECTED_TAG" ]]; then
  echo "Usage: verify-unsigned-macos-release.sh <assets-directory> <expected-tag>"
  exit 2
fi

EXPECTED_VERSION="${EXPECTED_TAG#v}"
EXPECTED_REPOSITORY="${GITHUB_REPOSITORY:-punkcanyang/GoodPhotos}"
ARCHIVE_PATH="$ASSETS_DIR/GoodPhotos_aarch64.app.tar.gz"
SIGNATURE_PATH="$ARCHIVE_PATH.sig"
DMG_PATH="$ASSETS_DIR/GoodPhotos_${EXPECTED_VERSION}_aarch64.dmg"
METADATA_PATH="$ASSETS_DIR/latest.json"
PUBLIC_KEY_PATH="src-tauri/updater.pubkey"

for artifact in "$ARCHIVE_PATH" "$SIGNATURE_PATH" "$DMG_PATH" "$METADATA_PATH" "$PUBLIC_KEY_PATH"; do
  if [[ ! -s "$artifact" ]]; then
    echo "::error::Required release artifact is missing or empty: $artifact"
    exit 1
  fi
done

node scripts/release/verify-updater-signature.mjs \
  "$ARCHIVE_PATH" \
  "$SIGNATURE_PATH" \
  "$PUBLIC_KEY_PATH"

node scripts/release/verify-release-metadata.mjs \
  "$METADATA_PATH" \
  "$SIGNATURE_PATH" \
  "$ARCHIVE_PATH" \
  "$EXPECTED_TAG" \
  "$EXPECTED_REPOSITORY"

ARCHIVE_VERSION="$(
  tar -xOf "$ARCHIVE_PATH" GoodPhotos.app/Contents/Info.plist \
    | plutil -extract CFBundleShortVersionString raw -
)"
if [[ "$ARCHIVE_VERSION" != "$EXPECTED_VERSION" ]]; then
  echo "::error::Updater archive version $ARCHIVE_VERSION does not match $EXPECTED_VERSION."
  exit 1
fi

hdiutil verify "$DMG_PATH"
shasum -a 256 "$ARCHIVE_PATH" "$SIGNATURE_PATH" "$DMG_PATH" "$METADATA_PATH"

echo "::warning::Apple signing/notarization is intentionally disabled by project policy."
echo "Unsigned macOS release artifacts passed updater signature, metadata, version, and integrity checks."
