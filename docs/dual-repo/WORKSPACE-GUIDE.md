# GoodPhotos 雙 Repo 工作區指南

## 目標
把公開桌面端與私有計費後端分開維護，同時維持 Codex 協作脈絡連續。

## 目前環境（本機）
你目前的桌面端 repo 位於：

```text
/Users/punkcan/SourceCode/GoodPhotos/GoodPhotos-Desktop
```

## 建議目錄（沿用現況，不搬資料夾）
建議直接在同一層建立私有後端 repo：

```text
/Users/punkcan/SourceCode/GoodPhotos/
  GoodPhotos-Desktop/            # 公開 GitHub repo（目前已存在）
  goodphotos-billing-backend/    # 私有 repo（GitLab/Gitea/自架）
```

## Repo 邊界（務必固定）
- `GoodPhotos-Desktop` 只放：
  - Tauri/React UI
  - API client（呼叫後端）
  - 不包含任何點數扣款、訂閱判斷、支付 webhook 邏輯
- `goodphotos-billing-backend` 只放：
  - 會員、訂閱、儲值、點數帳本、風控、支付回呼
  - 所有商業規則與金鑰處理

## 共用文件（兩邊都要同步）
- `docs/dual-repo/shared/ARCHITECTURE.md`
- `docs/dual-repo/shared/API-CONTRACT.md`

## 一次性初始化（私有後端 repo）
在 `/Users/punkcan/SourceCode/GoodPhotos` 下執行：

```bash
mkdir -p /Users/punkcan/SourceCode/GoodPhotos/goodphotos-billing-backend
cd /Users/punkcan/SourceCode/GoodPhotos/goodphotos-billing-backend
git init
echo "billing-backend" > .goodphotos-repo-role
```

在私有後端 repo 根目錄建立角色標記檔（同步腳本會驗證）：
```bash
echo "billing-backend" > .goodphotos-repo-role
```

從 `GoodPhotos-Desktop` 執行 shared 文件同步：
```bash
npm run sync:shared-docs -- /Users/punkcan/SourceCode/GoodPhotos/goodphotos-billing-backend
```

## Codex 協作方式（維持連續）
1. 儘量固定在同一個 conversation thread 持續開發。
2. 每次開工先要求 Codex 讀：
   - `docs/dual-repo/shared/ARCHITECTURE.md`
   - `docs/dual-repo/shared/API-CONTRACT.md`
   - 目前要改的 repo 的 `AGENTS.md`（若有）
3. 有任何規則變更（扣點規則、錯誤碼、欄位）先更新共享文件，再改程式。
4. PR 說明引用共享文件章節，避免兩邊 drift。

## 安全基線
- 桌面端公開 repo 不得出現：
  - 支付 provider secret key
  - webhook signing secret
  - 後端 DB 連線字串
  - 後端計費核心程式碼
- CI 變數切分：
  - 公開 repo：只留公開設定（例如 `VITE_API_BASE_URL`）
  - 私有 repo：保留所有敏感變數
