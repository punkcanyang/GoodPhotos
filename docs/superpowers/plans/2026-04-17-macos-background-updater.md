# GoodPhotos macOS Background Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a macOS Apple Silicon auto-update flow that checks and downloads updates in the background from GitHub Releases, then installs only after the user explicitly clicks restart.

**Architecture:** Keep updater logic out of `App.tsx` by introducing a testable `src/utils/updater.ts` coordinator that wraps Tauri updater/process calls behind small interfaces. Wire the coordinator into the settings modal for a lightweight status UI, then add the native Tauri updater configuration and a GitHub Actions release workflow that publishes `latest.json` and signed updater artifacts.

**Tech Stack:** React 19, TypeScript, Tauri 2, Rust, `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process`, Node `assert`, `tsx`, GitHub Actions, `tauri-apps/tauri-action`

---

## File Map

- Modify: `package.json`
  Purpose: add updater runtime dependencies, `tsx` test tooling, and repeatable test scripts.
- Create: `src/utils/updater.ts`
  Purpose: hold updater state types, background-download coordinator, install/relaunch helper, and small pure helpers for UI.
- Create: `tests/updater.test.ts`
  Purpose: validate updater state transitions without depending on a live Tauri runtime.
- Modify: `src/App.tsx:1-140`
  Purpose: add updater state, app version state, effect hooks, and button handlers.
- Modify: `src/App.tsx:1595-1760`
  Purpose: render updater status and actions inside the existing settings modal.
- Modify: `src/i18n.ts:63-73,209-219`
  Purpose: add updater labels in both existing locales.
- Create: `src-tauri/updater.pubkey`
  Purpose: commit the updater public key so Rust can embed it at build time with `include_str!`.
- Modify: `src-tauri/Cargo.toml:20-29`
  Purpose: add native updater/process plugins.
- Modify: `src-tauri/src/lib.rs:90-108`
  Purpose: initialize updater/process plugins in the Tauri builder.
- Modify: `src-tauri/tauri.conf.json:25-35`
  Purpose: enable updater artifacts and point the updater at GitHub Releases `latest.json`.
- Modify: `src-tauri/capabilities/default.json:8-46`
  Purpose: allow updater and process APIs in the desktop window capability.
- Create: `.github/workflows/release.yml`
  Purpose: build and publish signed macOS releases from git tags.
- Create: `docs/release/macos-updater-checklist.md`
  Purpose: document one-time key generation, required GitHub secrets, and the manual release checklist.

## Task 1: Build a Testable Updater Coordinator

**Files:**
- Create: `src/utils/updater.ts`
- Create: `tests/updater.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing updater coordinator test**

```ts
import assert from "node:assert/strict";

import {
  applyDownloadedUpdate,
  createIdleUpdaterState,
  getUpdateStatusKey,
  runBackgroundUpdateCheck,
  type ManagedUpdate,
  type UpdaterState,
} from "../src/utils/updater";

function collectStates() {
  const states: UpdaterState[] = [];

  return {
    states,
    emit: (state: UpdaterState) => {
      states.push(state);
    },
  };
}

async function testNoUpdateReturnsToIdle(): Promise<void> {
  const { states, emit } = collectStates();

  const update = await runBackgroundUpdateCheck(async () => null, emit);

  assert.equal(update, null);
  assert.deepEqual(states, [
    { phase: "checking" },
    createIdleUpdaterState(),
  ]);
}

async function testBackgroundDownloadEndsReady(): Promise<void> {
  const { states, emit } = collectStates();

  const update: ManagedUpdate = {
    version: "0.1.1",
    currentVersion: "0.1.0",
    body: "Background updater smoke test",
    async download(onEvent) {
      onEvent?.({ event: "Started", data: { contentLength: 10 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 4 } });
      onEvent?.({ event: "Progress", data: { chunkLength: 6 } });
      onEvent?.({ event: "Finished" });
    },
    async install() {
      throw new Error("install should not run during background download");
    },
  };

  const pendingUpdate = await runBackgroundUpdateCheck(async () => update, emit);

  assert.equal(pendingUpdate, update);
  assert.equal(states[0].phase, "checking");
  assert.equal(states[1].phase, "available");
  assert.equal(states[2].phase, "downloading");
  assert.equal(states.at(-1)?.phase, "ready");
  assert.equal(states.at(-1)?.downloadedBytes, 10);
  assert.equal(states.at(-1)?.contentLength, 10);
  assert.equal(getUpdateStatusKey(states.at(-1)!), "updater.ready");
}

async function testInstallTriggersRelaunch(): Promise<void> {
  const { states, emit } = collectStates();
  const calls: string[] = [];

  const update: ManagedUpdate = {
    version: "0.1.1",
    currentVersion: "0.1.0",
    body: "Install smoke test",
    async download() {
      calls.push("download");
    },
    async install() {
      calls.push("install");
    },
  };

  await applyDownloadedUpdate(
    update,
    async () => {
      calls.push("relaunch");
    },
    emit,
  );

  assert.deepEqual(calls, ["install", "relaunch"]);
  assert.deepEqual(states.map((state) => state.phase), ["installing", "restarting"]);
}

async function main(): Promise<void> {
  await testNoUpdateReturnsToIdle();
  await testBackgroundDownloadEndsReady();
  await testInstallTriggersRelaunch();
  console.log("updater tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the new test and confirm it fails because the module does not exist yet**

```bash
npx tsx tests/updater.test.ts
```

Expected: FAIL with an error equivalent to `Cannot find module '../src/utils/updater'`.

- [ ] **Step 3: Create the minimal updater coordinator implementation**

```ts
export type UpdaterPhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "restarting"
  | "error";

export interface UpdaterState {
  phase: UpdaterPhase;
  version?: string;
  currentVersion?: string;
  notes?: string;
  downloadedBytes?: number;
  contentLength?: number;
  error?: string;
}

export type UpdateDownloadEvent =
  | {
      event: "Started";
      data: {
        contentLength?: number;
      };
    }
  | {
      event: "Progress";
      data: {
        chunkLength: number;
      };
    }
  | {
      event: "Finished";
    };

export interface ManagedUpdate {
  version: string;
  currentVersion?: string;
  body?: string;
  download(onEvent?: (event: UpdateDownloadEvent) => void): Promise<void>;
  install(): Promise<void>;
}

function toMetadata(update: Pick<ManagedUpdate, "version" | "currentVersion" | "body">) {
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body,
  };
}

export function createIdleUpdaterState(): UpdaterState {
  return { phase: "idle" };
}

export function getUpdateStatusKey(state: UpdaterState): string | null {
  switch (state.phase) {
    case "checking":
      return "updater.checking";
    case "downloading":
      return "updater.downloading";
    case "ready":
      return "updater.ready";
    case "error":
      return "updater.error";
    default:
      return null;
  }
}

export function describeUpdaterError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return "Unknown updater error";
}

export async function runBackgroundUpdateCheck(
  checkForUpdate: () => Promise<ManagedUpdate | null>,
  emit: (state: UpdaterState) => void,
): Promise<ManagedUpdate | null> {
  emit({ phase: "checking" });

  try {
    const update = await checkForUpdate();

    if (!update) {
      emit(createIdleUpdaterState());
      return null;
    }

    const metadata = toMetadata(update);
    emit({ phase: "available", ...metadata });

    let downloadedBytes = 0;
    let contentLength: number | undefined;

    await update.download((event) => {
      if (event.event === "Started") {
        contentLength = event.data.contentLength;
        emit({
          phase: "downloading",
          ...metadata,
          downloadedBytes,
          contentLength,
        });
        return;
      }

      if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        emit({
          phase: "downloading",
          ...metadata,
          downloadedBytes,
          contentLength,
        });
        return;
      }

      emit({
        phase: "ready",
        ...metadata,
        downloadedBytes,
        contentLength,
      });
    });

    if (downloadedBytes === 0 && contentLength === undefined) {
      emit({ phase: "ready", ...metadata });
    }

    return update;
  } catch (error) {
    emit({
      phase: "error",
      error: describeUpdaterError(error),
    });
    return null;
  }
}

export async function applyDownloadedUpdate(
  update: ManagedUpdate,
  relaunchApp: () => Promise<void>,
  emit: (state: UpdaterState) => void,
): Promise<void> {
  const metadata = toMetadata(update);

  try {
    emit({ phase: "installing", ...metadata });
    await update.install();
    emit({ phase: "restarting", ...metadata });
    await relaunchApp();
  } catch (error) {
    emit({
      phase: "error",
      ...metadata,
      error: describeUpdaterError(error),
    });
    throw error;
  }
}
```

- [ ] **Step 4: Add repeatable test tooling and scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri dev": "tauri dev",
    "test:providers": "npx tsx tests/llmClient.providers.test.ts",
    "test:rate-limit": "npx tsx tests/llmClient.rate-limit.test.ts",
    "test:updater": "npx tsx tests/updater.test.ts",
    "test": "npm run test:providers && npm run test:rate-limit && npm run test:updater"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-dialog": "^2.6.0",
    "@tauri-apps/plugin-fs": "^2.4.5",
    "@tauri-apps/plugin-opener": "^2",
    "@tauri-apps/plugin-process": "^2",
    "@tauri-apps/plugin-shell": "^2.3.5",
    "@tauri-apps/plugin-updater": "^2",
    "clsx": "^2.1.1",
    "exifr": "^7.1.3",
    "i18next": "^25.8.13",
    "lucide-react": "^0.575.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-i18next": "^16.5.4",
    "react-markdown": "^10.1.0",
    "react-sketch-canvas": "^6.2.0",
    "tailwind-merge": "^3.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.0",
    "@tauri-apps/cli": "^2",
    "@types/node": "^22.15.3",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.0",
    "autoprefixer": "^10.4.24",
    "postcss": "^8.5.6",
    "tailwindcss": "^4.2.0",
    "tsx": "^4.19.4",
    "typescript": "~5.8.3",
    "vite": "^7.0.4"
  }
}
```

- [ ] **Step 5: Run the updater test and then the full existing test suite**

```bash
npm run test:updater
npm run test
```

Expected:
- First command prints `updater tests passed`
- Second command prints all three test success lines and exits with code 0

- [ ] **Step 6: Commit the isolated coordinator work**

```bash
git add package.json src/utils/updater.ts tests/updater.test.ts
git commit -m "test: add updater coordinator coverage"
```

## Task 2: Wire Native Tauri Updater and Build Configuration

**Files:**
- Create: `src-tauri/updater.pubkey`
- Modify: `src-tauri/Cargo.toml:20-29`
- Modify: `src-tauri/src/lib.rs:90-108`
- Modify: `src-tauri/tauri.conf.json:25-35`
- Modify: `src-tauri/capabilities/default.json:8-46`

- [ ] **Step 1: Add the native updater/process crates**

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2.4.5"
tauri-plugin-process = "2"
tauri-plugin-shell = "2.3.5"
tauri-plugin-updater = "2"
xattr = "1.6.1"
plist = "1.8.0"
```

- [ ] **Step 2: Generate the updater keypair once and commit the public key file**

```bash
npm run tauri signer generate -- -w ~/.tauri/goodphotos-updater.key
cp ~/.tauri/goodphotos-updater.key.pub src-tauri/updater.pubkey
```

Expected:
- The first command writes `~/.tauri/goodphotos-updater.key` and `~/.tauri/goodphotos-updater.key.pub`
- The second command creates the tracked file `src-tauri/updater.pubkey`

- [ ] **Step 3: Initialize updater/process plugins in Rust and embed the public key**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let updater_pubkey = include_str!("../updater.pubkey").trim().to_string();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_updater::Builder::new()
                .pubkey(updater_pubkey)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            set_macos_file_tags,
            get_macos_file_tags,
            read_file_bytes,
            write_text_file,
            write_binary_file,
            copy_file,
            create_dir_all
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 4: Add updater endpoints, updater artifacts, and permissions**

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "createUpdaterArtifacts": true,
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://github.com/punkcanyang/GoodPhotos/releases/latest/download/latest.json"
      ]
    }
  }
}
```

```json
{
  "permissions": [
    "core:default",
    "opener:default",
    "opener:allow-open-path",
    "opener:allow-reveal-item-in-dir",
    "dialog:default",
    "fs:default",
    "fs:allow-read",
    "fs:allow-stat",
    "process:default",
    "updater:default",
    {
      "identifier": "fs:allow-read",
      "allow": [
        { "path": "$HOME/**" },
        { "path": "/**" },
        { "path": "**/*" }
      ]
    },
    {
      "identifier": "fs:allow-stat",
      "allow": [
        { "path": "$HOME/**" },
        { "path": "/**" },
        { "path": "**/*" }
      ]
    },
    "fs:read-all"
  ]
}
```

- [ ] **Step 5: Run a native compile smoke check**

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: PASS with Cargo finishing the check successfully.

- [ ] **Step 6: Commit the native updater configuration**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/updater.pubkey
git commit -m "feat: configure tauri updater runtime"
```

## Task 3: Integrate the Updater UI into the Existing Settings Modal

**Files:**
- Modify: `src/App.tsx:1-140`
- Modify: `src/App.tsx:1595-1760`
- Modify: `src/i18n.ts:63-73,209-219`

- [ ] **Step 1: Add app-version and updater state at the top of `App.tsx`**

```ts
import { useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import {
  applyDownloadedUpdate,
  createIdleUpdaterState,
  getUpdateStatusKey,
  runBackgroundUpdateCheck,
  type ManagedUpdate,
  type UpdateDownloadEvent,
  type UpdaterState,
} from "./utils/updater";

function App() {
  const { t, i18n } = useTranslation();
  const [appVersion, setAppVersion] = useState("0.1.0");
  const [updaterState, setUpdaterState] = useState<UpdaterState>(createIdleUpdaterState());
  const pendingUpdateRef = useRef<ManagedUpdate | null>(null);
```

- [ ] **Step 2: Add the updater bootstrapping effects and handlers**

```ts
  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const version = await getVersion();
          if (!cancelled) {
            setAppVersion(version);
          }
        } catch (error) {
          console.error("Failed to resolve app version", error);
        }

        if (!cancelled) {
          await handleBackgroundUpdateCheck();
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const handleBackgroundUpdateCheck = async () => {
    const pendingUpdate = await runBackgroundUpdateCheck(
      async () => {
        const update = await check();
        if (!update) {
          return null;
        }

        return {
          version: update.version,
          currentVersion: appVersion,
          body: update.body,
          download(onEvent) {
            return update.download((event) => {
              if (event.event === "Started") {
                onEvent?.({
                  event: "Started",
                  data: { contentLength: event.data.contentLength },
                } satisfies UpdateDownloadEvent);
              } else if (event.event === "Progress") {
                onEvent?.({
                  event: "Progress",
                  data: { chunkLength: event.data.chunkLength },
                } satisfies UpdateDownloadEvent);
              } else {
                onEvent?.({ event: "Finished" });
              }
            });
          },
          install() {
            return update.install();
          },
        } satisfies ManagedUpdate;
      },
      (nextState) => {
        setUpdaterState(nextState);
      },
    );

    pendingUpdateRef.current = pendingUpdate;
  };

  const handleInstallUpdate = async () => {
    if (!pendingUpdateRef.current) {
      return;
    }

    await applyDownloadedUpdate(
      pendingUpdateRef.current,
      async () => {
        await relaunch();
      },
      (nextState) => {
        setUpdaterState(nextState);
      },
    );
  };
```

- [ ] **Step 3: Replace the hardcoded version badge and add updater controls in the settings modal**

```tsx
<h3 className="text-xl font-bold text-neutral-100 flex items-center justify-center gap-2">
  Punkcan{" "}
  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-mono border border-blue-500/20">
    v{appVersion}
  </span>
</h3>
```

```tsx
<div className="pt-4 border-t border-neutral-700/50 mt-4">
  <h4 className="text-sm font-bold text-neutral-200 mb-3 flex items-center gap-2">
    <Download className="w-4 h-4 text-blue-400" />
    {t("updater.title")}
  </h4>

  {getUpdateStatusKey(updaterState) && (
    <p className="text-xs text-neutral-400 mb-3">
      {t(getUpdateStatusKey(updaterState)!, {
        version: updaterState.version,
        currentVersion: updaterState.currentVersion,
        downloadedBytes: updaterState.downloadedBytes ?? 0,
        contentLength: updaterState.contentLength ?? 0,
        error: updaterState.error ?? "",
      })}
    </p>
  )}

  <div className="flex items-center gap-3">
    <button
      type="button"
      onClick={() => {
        void handleBackgroundUpdateCheck();
      }}
      disabled={
        updaterState.phase === "checking" ||
        updaterState.phase === "downloading" ||
        updaterState.phase === "installing" ||
        updaterState.phase === "restarting"
      }
      className="px-4 py-2 rounded-xl text-sm font-medium bg-neutral-900 border border-neutral-700 text-neutral-200 disabled:opacity-50"
    >
      {t("updater.checkNow")}
    </button>

    {updaterState.phase === "ready" && pendingUpdateRef.current && (
      <button
        type="button"
        onClick={() => {
          void handleInstallUpdate();
        }}
        className="px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white"
      >
        {t("updater.installNow")}
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 4: Add i18n strings for both existing locales**

```ts
settings: {
  title: "AI Engine Settings",
  subtitle: "Configure your preferred LLM provider & parameters.",
  provider: "Provider",
  modelName: "Model Name",
  apiKey: "API Key",
  baseUrl: "Base URL (Optional)",
  cancel: "Cancel",
  save: "Save",
  interfaceLang: "Interface Language"
},
updater: {
  title: "App Updates",
  checkNow: "Check for Updates",
  installNow: "Restart to Update",
  checking: "Checking for updates in the background...",
  downloading: "Downloading {{version}} in the background ({{downloadedBytes}} / {{contentLength}} bytes)...",
  ready: "Version {{version}} has been downloaded. Restart the app to apply it.",
  error: "Update failed: {{error}}"
},
```

```ts
settings: {
  title: "AI 核心引擎设置",
  subtitle: "配置您偏好的大模型供应商及自定义参数。",
  provider: "驱动引擎 (Provider)",
  modelName: "模型名称 (Model Name)",
  apiKey: "API Key (密钥)",
  baseUrl: "接口代理地址 (Base URL) [选填]",
  cancel: "取消",
  save: "保存设置",
  interfaceLang: "界面语言 (Language)"
},
updater: {
  title: "应用更新",
  checkNow: "检查更新",
  installNow: "重新启动并更新",
  checking: "正在背景检查新版本...",
  downloading: "正在背景下载 {{version}}（{{downloadedBytes}} / {{contentLength}} bytes）...",
  ready: "版本 {{version}} 已下载完成，重新启动后即可套用。",
  error: "更新失败：{{error}}"
},
```

- [ ] **Step 5: Run the updater tests again and then run the production build**

```bash
npm run test:updater
npm run build
```

Expected:
- `npm run test:updater` still passes
- `npm run build` finishes without TypeScript or Vite errors

- [ ] **Step 6: Commit the UI integration**

```bash
git add src/App.tsx src/i18n.ts
git commit -m "feat: surface background updates in settings"
```

## Task 4: Add GitHub Releases Automation and Release Documentation

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `docs/release/macos-updater-checklist.md`

- [ ] **Step 1: Document the one-time key setup and repeatable release checklist**

````md
# macOS Updater Release Checklist

## One-time setup

1. Generate the updater keypair:

   ```bash
   npm run tauri signer generate -- -w ~/.tauri/goodphotos-updater.key
   cp ~/.tauri/goodphotos-updater.key.pub src-tauri/updater.pubkey
   ```

2. Add GitHub repository secrets:

   - `TAURI_SIGNING_PRIVATE_KEY`: contents of `~/.tauri/goodphotos-updater.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the password entered during key generation

## Per-release checklist

1. Bump `package.json` and `src-tauri/tauri.conf.json` to the same version.
2. Run:

   ```bash
   npm run test
   npm run build
   cargo check --manifest-path src-tauri/Cargo.toml
   ```

3. Create and push the tag:

   ```bash
   git tag v0.1.1
   git push origin v0.1.1
   ```

4. Wait for the GitHub Actions `release` workflow to publish:

   - `GoodPhotos_0.1.1_aarch64.dmg`
   - updater `.app.tar.gz`
   - updater `.sig`
   - `latest.json`
````

- [ ] **Step 2: Create the release workflow**

```yaml
name: release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  release-macos:
    runs-on: macos-latest
    env:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Rust artifacts
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri -> target

      - name: Install frontend dependencies
        run: npm ci

      - name: Run tests
        run: npm run test

      - name: Build and publish Tauri release
        uses: tauri-apps/tauri-action@v0.6.0
        with:
          tagName: ${{ github.ref_name }}
          releaseName: GoodPhotos ${{ github.ref_name }}
          releaseDraft: false
          prerelease: false
          generateReleaseNotes: true
          args: --target aarch64-apple-darwin
          uploadUpdaterJson: true
```

- [ ] **Step 3: Run a static sanity check on the new docs and workflow**

```bash
git diff --check
rg -n "TAURI_SIGNING_PRIVATE_KEY|uploadUpdaterJson|latest.json|goodphotos-updater.key" .github/workflows/release.yml docs/release/macos-updater-checklist.md
```

Expected:
- `git diff --check` prints nothing
- `rg` prints the expected workflow and checklist lines

- [ ] **Step 4: Commit the release automation**

```bash
git add .github/workflows/release.yml docs/release/macos-updater-checklist.md
git commit -m "ci: add macOS updater release workflow"
```

## Task 5: Final Verification Pass Before Tagging a Real Release

**Files:**
- Modify: none
- Test: `tests/updater.test.ts`

- [ ] **Step 1: Run the full project verification suite**

```bash
npm run test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: all three commands exit successfully.

- [ ] **Step 2: Inspect the app-level updater wiring**

```bash
rg -n "handleBackgroundUpdateCheck|handleInstallUpdate|updater.title|Restart to Update|重新启动并更新" src/App.tsx src/i18n.ts
rg -n "createUpdaterArtifacts|releases/latest/download/latest.json" src-tauri/tauri.conf.json
rg -n "tauri_plugin_updater|tauri_plugin_process|updater:default|process:default" src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/capabilities/default.json
```

Expected: the grep output shows all expected updater touchpoints in the app, config, and capability files.

- [ ] **Step 3: Stage the final state only after every verification command is green**

```bash
git status --short
git add package.json src/App.tsx src/i18n.ts src/utils/updater.ts tests/updater.test.ts src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/updater.pubkey .github/workflows/release.yml docs/release/macos-updater-checklist.md
git status --short
```

Expected:
- The first `git status --short` shows only the updater-related files above
- The second `git status --short` shows staged `A/M` entries for the same file list and no unrelated paths

## Self-Review

- Spec coverage check:
  - Background `check()` and `download()` are covered in Task 1 and Task 3.
  - Explicit user-triggered `install + relaunch` is covered in Task 1 and Task 3.
  - GitHub Releases + `latest.json` publication is covered in Task 4.
  - macOS-only release path is enforced in Task 4 via `--target aarch64-apple-darwin`.
- Placeholder scan:
  - No `TODO`, `TBD`, or “implement later” markers remain.
  - The public key is handled via a real generated file path, not a fake inline placeholder.
- Type consistency:
  - `UpdaterState`, `ManagedUpdate`, and `UpdateDownloadEvent` are defined once in `src/utils/updater.ts` and reused by tests and UI.
