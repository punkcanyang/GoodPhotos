# macOS Updater Release Checklist

## One-time setup

1. Generate the updater keypair:

   ```bash
   npm run tauri -- signer generate --ci -p '<strong-password>' -w ~/.tauri/goodphotos-updater.key
   cp ~/.tauri/goodphotos-updater.key.pub src-tauri/updater.pubkey
   ```

2. Add GitHub repository secrets:

   - `TAURI_SIGNING_PRIVATE_KEY`: contents of `~/.tauri/goodphotos-updater.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password entered during key generation

3. Keep the updater private key in a password manager or other durable secure storage.

GoodPhotos currently does not participate in the paid Apple Developer Program.
Stable macOS downloads are intentionally unsigned and are not notarized. The
Tauri updater archive remains cryptographically signed with the dedicated
GoodPhotos updater key.

## Per-release checklist

1. Bump `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` to the same version.
2. Run:

   ```bash
   npm run test
   npm run build
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

3. Create and push the tag:

   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. Wait for the GitHub Actions `release` workflow to publish:

   - workflow first creates a draft and downloads its actual assets
   - updater `.app.tar.gz` must pass Ed25519/Minisign verification against `src-tauri/updater.pubkey`
   - `latest.json` version, tag, archive URL, and embedded signature must agree
   - the archive bundle version must match the tag
   - `hdiutil verify` must pass for the DMG
   - the Release body must visibly disclose that the macOS build is unsigned and not notarized
   - `GoodPhotos_X.Y.Z_aarch64.dmg`
   - updater `.app.tar.gz`
   - updater `.sig`
   - `latest.json`

   Only after these checks pass may the workflow publish the draft as a stable
   release.

5. Install the previous release on a macOS Apple Silicon machine, then verify:

   - the app detects the new release in the background
   - the updater downloads it without forcing the app closed
   - the app restarts successfully after clicking `重新启动并更新`
