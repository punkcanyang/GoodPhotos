# 雙 Repo 協作入口

這份文件是 GoodPhotos 的雙 repo 協作總入口，目的如下：
- 公開桌面端與私有計費後端分離維護
- 前後端契約一致，避免欄位漂移
- 讓 Codex 在多 repo 開發時仍維持脈絡連續

## 目前開發環境（本機）
```text
/Users/punkcan/SourceCode/GoodPhotos/
  GoodPhotos-Desktop/            # 公開 GitHub repo（目前已存在）
  goodphotos-billing-backend/    # 私有 repo（同層新增）
```

## 目錄
- [工作區佈局指南](./WORKSPACE-GUIDE.md)
- [Codex 開工清單](./CODEX-SESSION-CHECKLIST.md)
- [共享架構決策](./shared/ARCHITECTURE.md)
- [共享 API 契約](./shared/API-CONTRACT.md)

## 建議協作流程
1. 開工前先讀 `shared/ARCHITECTURE.md` 與 `shared/API-CONTRACT.md`。
2. 需要改契約時，先更新 `shared` 文件，再更新程式碼。
3. 每次發版前執行公開 repo 安全檢查：
   - `npm run guard:public-repo`
4. 若安全檢查有誤報，可在 allowlist 管理：
   - `docs/dual-repo/secret-scan-allowlist.regex`
5. 同步 shared 文件到後端前，確認私有 repo 根目錄有角色標記檔：
   - `.goodphotos-repo-role` 內容必須是 `billing-backend`
