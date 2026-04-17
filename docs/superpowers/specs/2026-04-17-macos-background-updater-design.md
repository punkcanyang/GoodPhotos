# GoodPhotos macOS 背景更新設計

日期: 2026-04-17
狀態: 已確認方向，待實作
範圍: `macOS Apple Silicon`、`GitHub Releases`、`背景檢查與下載`、`使用者按重新啟動時才安裝`

## 1. 背景與目標

GoodPhotos 目前是 Tauri 2 桌面 App，尚未接入官方 updater。這次要補上的能力是：

- App 啟動後可在背景檢查新版
- 發現新版後可在背景下載更新檔
- 下載完成後只提示使用者「重新啟動後套用」
- 不在背景自動安裝，不強制關閉 App
- 使用者按下重新啟動後，才開始安裝並重新開啟 App

此設計刻意不處理 Windows，自動更新第一版只保證 `macOS Apple Silicon` 可用。

## 2. 非目標

以下項目不納入本次設計：

- Windows 自動更新
- Intel macOS 自動更新
- beta / stable 更新通道
- 分批 rollout
- 自建動態 update API
- 強制更新
- 自動在背景安裝後強制重啟

## 3. 核心決策

### 3.1 更新方案

採用 `Tauri 官方 updater plugin`，不自行實作下載、驗證與替換邏輯。

理由：

- 專案本身已是 Tauri 2，整合成本最低
- 官方 updater 已處理簽章驗證
- JavaScript API 已提供 `check()`、`download()`、`install()` 的分階段流程，可直接符合本案需求

### 3.2 更新來源

採用 `GitHub Releases + static latest.json`。

理由：

- 維護成本最低
- 與 `tauri-apps/tauri-action` 相容
- 不需要額外維護 update server

### 3.3 平台策略

第一版只開 `macOS Apple Silicon`。

理由：

- 專案目前未驗證 Windows 打包流程
- updater 的安裝行為與 artifact 形式跨平台有差異
- 先把單一路徑走通，後續再擴平台風險最低

## 4. 使用者體驗設計

### 4.1 狀態機

前端維護以下更新狀態：

- `idle`: 尚未檢查
- `checking`: 正在檢查更新
- `available`: 已找到新版，準備下載
- `downloading`: 正在背景下載
- `ready`: 更新已下載完成，等待使用者重新啟動
- `error`: 檢查、下載或安裝失敗

### 4.2 使用者流程

1. 使用者開啟 App
2. App 在背景啟動更新檢查
3. 若沒有新版，不打擾使用者
4. 若有新版，背景下載更新檔
5. 下載完成後顯示非阻斷提示
6. 使用者自行決定何時按「重新啟動並更新」
7. App 執行安裝並重新啟動

### 4.3 UI 原則

- 不使用 blocking modal 強迫中斷當前操作
- 預設只顯示輕量狀態文字與按鈕
- 第一版將入口放在現有設定區或資訊區，避免大幅改版
- 若更新失敗，只顯示一次錯誤訊息，不反覆跳提醒

建議文案：

- `正在檢查更新`
- `正在背景下載更新`
- `新版已下載，重新啟動後套用`
- `重新啟動並更新`
- `更新失敗，稍後再試`

## 5. 技術設計

### 5.1 Tauri 設定

需要補上的能力：

- 前端依賴：`@tauri-apps/plugin-updater`
- 前端依賴：`@tauri-apps/plugin-process`
- Rust 依賴：`tauri-plugin-updater`
- Rust 依賴：`tauri-plugin-process`
- capability：`updater:default`
- capability：`process:default`

`src-tauri/tauri.conf.json` 需新增：

- updater `pubkey`
- updater `endpoints`
- `bundle.createUpdaterArtifacts = true`

`endpoints` 指向 GitHub Releases 上可公開讀取的 `latest.json`。

### 5.2 App 端更新流程

建議封裝成獨立 updater 模組，避免把更新邏輯全部塞進 `App.tsx`。

流程如下：

1. App 啟動後延遲數秒執行 `check()`
2. 若回傳 `null`，流程結束
3. 若有 `Update` 物件，立即切到 `available`
4. 呼叫 `download()` 進入 `downloading`
5. 下載完成後保留 `Update` 物件參考，狀態改為 `ready`
6. 使用者按下按鈕時，呼叫 `install()`
7. `install()` 成功後呼叫 `relaunch()`

### 5.3 為何不在背景直接安裝

本案需求是「背景下載，使用者重啟後套用」，不是「背景安裝」。

因此第一版只允許：

- 背景 `check`
- 背景 `download`
- 前景使用者操作觸發 `install + relaunch`

這樣可避免：

- 使用者正在選片或輸出時 App 被突然關閉
- 安裝流程跨平台差異提早滲入第一版

### 5.4 當前工作保護

第一版不做完整工作區快照恢復，但 UI 必須避免在未經確認的情況下自動安裝。

這代表：

- App 不自動呼叫 `install()`
- 只有使用者按下更新按鈕時才進入安裝
- 後續若需要，可再補「安裝前檢查是否有進行中的分析任務」保護

## 6. 發版流程設計

### 6.1 金鑰

使用 Tauri signer 產生 updater 公私鑰：

- 公鑰：進 repo config
- 私鑰：存 GitHub Actions secrets

限制：

- 後續所有更新都必須持續使用同一把私鑰
- 私鑰遺失後，既有使用者將無法再信任新更新

### 6.2 GitHub Actions

新增 release workflow，建議由 git tag 觸發，例如 `v0.1.1`。

流程：

1. 安裝 Node / Rust 依賴
2. 注入 `TAURI_SIGNING_PRIVATE_KEY`
3. 執行 Tauri build，產出 updater artifacts
4. 用 `tauri-apps/tauri-action` 建立或更新 GitHub Release
5. 上傳 `.dmg`、`.app.tar.gz`、`.sig` 與 `latest.json`

### 6.3 版本規範

每次 release 需保持以下版本一致：

- `package.json`
- `src-tauri/tauri.conf.json`
- git tag
- GitHub Release

若版本與 tag 不一致，updater 很容易出現錯誤判斷或無法升級。

## 7. 測試策略

至少要驗證以下場景：

### 7.1 正常更新

1. 安裝舊版 App
2. 發佈新版 GitHub Release
3. 啟動舊版 App
4. 確認背景檢查成功
5. 確認背景下載成功
6. 確認 UI 顯示「重新啟動並更新」
7. 觸發安裝與重啟
8. 確認版本已更新

### 7.2 無更新

- `check()` 回傳 `null`
- UI 不應出現多餘提示

### 7.3 下載失敗

- 網路錯誤或 JSON/簽章錯誤時
- UI 應進入 `error`
- 不應卡死在 `downloading`

### 7.4 使用者延後更新

- 下載完成後不立即按更新
- App 仍可繼續使用
- 直到使用者主動觸發才安裝

## 8. 風險與對策

### 8.1 私鑰管理

風險最高。若遺失私鑰，將中斷現有用戶的後續升級路徑。

對策：

- 私鑰放入密碼管理與 GitHub Secrets
- 將使用與備援流程寫入 release 文件

### 8.2 Release 資產對應錯誤

`latest.json`、更新檔 URL、簽章內容任何一處不匹配，都會導致更新失敗。

對策：

- 優先用 `tauri-action` 自動生成
- 不手動維護多份 release metadata

### 8.3 App.tsx 持續膨脹

目前 `src/App.tsx` 已承載大量 UI 與流程邏輯，若直接把 updater 邏輯塞進去，可讀性會再惡化。

對策：

- 將 updater 寫成獨立 hook 或 utility
- `App.tsx` 只保留狀態顯示與按鈕綁定

## 9. 實作分段

建議分兩批提交：

### 批次一：App 端整合

- 接入 updater / process plugin
- 補 Tauri config 與 capability
- 實作前端更新狀態機
- 顯示更新 UI

### 批次二：發版流程

- 新增 GitHub Actions release workflow
- 配置 updater 簽章 secrets
- 發版文件與驗證步驟

## 10. 驗收標準

以下條件全部成立才算完成第一版：

- 在 macOS Apple Silicon 上可從舊版檢查到新版
- 可在背景下載更新
- 使用者未點按前，不會自動安裝
- 點按「重新啟動並更新」後可成功升級
- 升級後 App 可正常開啟
- 現有 localStorage 設定不受影響
