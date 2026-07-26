# Codex Session 開工清單（雙 Repo）

## 每次開工固定步驟
1. 指定本次要改哪個 repo（desktop 或 billing-backend）。
2. 先讀以下文件再開始改碼：
   - `docs/dual-repo/shared/ARCHITECTURE.md`
   - `docs/dual-repo/shared/API-CONTRACT.md`
   - 目標 repo 的 `AGENTS.md`（若有）
3. 先確認本次變更是否會影響 API 契約或計費規則。
4. 若有影響，先更新共享文件再實作。

## 可直接貼給 Codex 的起手 prompt
```text
請先讀 docs/dual-repo/shared/ARCHITECTURE.md、docs/dual-repo/shared/API-CONTRACT.md，
並同步目前 repo 的 AGENTS.md。
這次任務是：<填你的任務>。
先列出會影響的檔案與風險，再開始修改。
```

## PR 說明模板（簡版）
```text
## 變更摘要
- 

## 契約影響
- [ ] 無 API 欄位異動
- [ ] 有 API 欄位異動（已更新 docs/dual-repo/shared/API-CONTRACT.md）

## 計費影響
- [ ] 無
- [ ] 有（已更新 docs/dual-repo/shared/ARCHITECTURE.md 對應章節）
```
