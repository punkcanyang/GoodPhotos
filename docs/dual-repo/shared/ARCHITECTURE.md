# GoodPhotos 共用架構決策（跨 Repo）

## 1. 系統範圍
- `GoodPhotos-Desktop`：桌面端（Tauri + React）
- `goodphotos-billing-backend`：會員/訂閱/儲值/點數後端（私有）

## 2. 計費模式（正式版）
- 模式 A：BYOK（使用者自備 API Key）
  - 不扣平台點數
  - 可搭配訂閱解鎖進階功能
- 模式 B：官方代跑（平台代付模型成本）
  - 走平台點數扣款
  - 可搭配訂閱送點數

## 3. 信任邊界
- 桌面端只顯示方案狀態與點數餘額，不做扣點判斷。
- 扣點、退款、活動贈點、風控、webhook 驗簽只在後端。
- 所有正式計費請求都需帶 `Idempotency-Key`。

## 4. 點數帳本原則
- 使用不可變 `ledger`（append-only）。
- 流程採「預扣 -> 結算」：
1. authorize（預扣）
2. provider 呼叫完成
3. settle（多退少補）
- 任一階段失敗需可重試，且不得重複扣款。

## 5. 訂閱狀態來源
- 訂閱真實狀態以支付平台 webhook 同步結果為準。
- 使用者端查詢僅讀後端快照，不直連支付平台。

## 6. 共用資料契約
- 跨 repo API 欄位與錯誤碼，以 `docs/dual-repo/shared/API-CONTRACT.md` 為單一真相來源。
- 任何欄位異動先更新契約，再做實作。

## 7. 觀測與稽核
- 每筆扣點關聯：
  - `user_id`
  - `operation_id`
  - `idempotency_key`
  - `request_hash`
  - `provider_usage`（token/圖片張數等）
- 關鍵事件必須可追蹤：建立訂閱、續訂、扣點、退款、爭議款。

## 8. 禁止事項
- 禁止在公開 repo 存放：
  - 支付金鑰
  - webhook secret
  - 後端 DB 連線資訊
  - 後端計費核心程式碼
