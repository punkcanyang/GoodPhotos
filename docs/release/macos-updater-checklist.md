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
   - `APPLE_CERTIFICATE`: base64 of exported Developer ID Application `.p12`
   - `APPLE_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`
   - `APPLE_SIGNING_IDENTITY`: e.g. `Developer ID Application: Your Name (TEAMID)`
   - `APPLE_ID`: Apple Account email
   - `APPLE_PASSWORD`: app-specific password (from appleid.apple.com)
   - `APPLE_TEAM_ID`: Apple Developer Team ID

3. Keep the updater private key in a password manager or other durable secure storage.

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

   - workflow should pass `Validate macOS signing secrets`
   - `GoodPhotos_X.Y.Z_aarch64.dmg`
   - updater `.app.tar.gz`
   - updater `.sig`
   - `latest.json`

5. Install the previous release on a macOS Apple Silicon machine, then verify:

   - the app detects the new release in the background
   - the updater downloads it without forcing the app closed
   - the app restarts successfully after clicking `重新启动并更新`
