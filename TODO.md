# 任务清单

- [x] 1. 照片移除功能
  - [x] 在 `App.tsx` 中编写 `handleRemoveImage` 函数，从 `images` 状态中删除指定 ID 的照片。
  - [x] 在画廊每个照片卡片的右上角增加一个红色的关闭 `X` 按钮组件（当非多选模式时显示）。
- [x] 2. 照片放大检视功能
  - [x] 在 `App.tsx` 中新增 `enlargedImageId` 状态用于控制当前居中放大的图片。
  - [x] 当点击照片卡片时（如果非多选模式），除了原本的焦点选择逻辑外，更新 `enlargedImageId` 全屏展示这部分。
  - [x] 编写全屏放大遮罩弹窗 (Modal) UI 覆盖整个应用，点击背景关闭。
- [x] 3. 放大检视导航功能
  - [x] 在 `App.tsx` 中监听键盘 `ArrowLeft` 和 `ArrowRight` 事件，实现放大状态下的图片切换。
  - [x] 在放大的图片两侧添加「上一张」、「下一张」的悬浮按钮。
- [x] 4. 放大检视的标签与移除功能
  - [x] 在 `App.tsx` 的全屏放大视图中，新增「移除照片」和「贴标签」的悬浮按钮。
  - [x] 修改 `handleAddTags` 函数使其在单张照片放大检视时也能兼容打标签逻辑。
  - [x] 修改移除照片逻辑，在全屏视图移除照片时自动切换到下一张（如果存在）。
- [x] 5. 标签库 (Tag Library)
  - [x] 在 `App.tsx` 中增加 `recentTags` 状态，并在组件挂载时从 `localStorage` 读取。
  - [x] 在执行 `handleAddTags` 时，自动将新标签加入 `recentTags`（去重并保留最近使用，比如限制最多 20 个），同时同步到 `localStorage`。
  - [x] 在「贴标签的弹窗」内展示这些历史标签的按钮，点击即可迅速追加到输入框 `tagInput` 中。
- [x] 6. 提升预览图的压缩分辨率
  - [x] 修改 `src/utils/imageProcessor.ts` 中的默认 `maxSize`，从 1024 提升到 2048（或更大）。
  - [x] 同时微调默认的质量 (quality)，例如从 0.8 升至 0.85，以提升感官上的清晰度。
- [x] 7. 放大图的 AI 深度阅片点评
  - [x] 在 `src/utils/qwenClient.ts` 中新增 `critiqueImage` 函数，调用 Vision 模型，以“专业摄影师角度”评估相片的构图、打光等指标，并返回详细文本。
  - [x] 在 `App.tsx` 放大视图的下方或右侧添加一个「AI专业点评」的按钮。
  - [x] 点击按钮后展示 Loading 状态，调用 `critiqueImage` 并在图片旁边（或覆盖一层）的面板显示点评文字。
- [x] 8. 提升 AI 点评专业度与调教参数
  - [x] 在 `qwenClient.ts` 的 `critiqueImage` 方法中重构 System Prompt，增加“苛刻、毒舌、找缺点”的人设。
  - [x] 增加输出评价的具体约束条款（如地平线、边缘裁切、光影断层等），现已改为严格换行的专业指导建议。
  - [x] 调低 API 请求的 `temperature` 至 `0.5`，使输出更聚焦。
- [x] 9. 自定义 API Key 设置功能
  - [x] 在 `qwenClient.ts` 中优先从 `localStorage` 读取 `goodphoto_api_key`。
  - [x] 在 `App.tsx` 左侧抽屉增加「设置」入口按钮。
  - [x] 在 `App.tsx` 新增弹窗组件 (Settings Modal)，支持输入、保存 API Key 到本地。
- [x] 10. 增加「拉杆式」评分过滤功能
  - [x] 在 `App.tsx` 的所有过滤器按钮组旁边增加一个 `input type="range"`。
  - [x] 根据拉杆选定的最低分过滤掉照片池中低于阈值的照片。
- [x] 11. 融合大师级艺术审美底层 Prompt
  - [x] 修改 `qwenClient.ts` 中 `evaluateImages` 的系统提示词，引入 Magnum / Vogue / National Geographic 作为潜台词标准。
  - [x] 强制要求模型后台计算构图张力、光影、情绪等 6 大维度，最终输出具有深度艺术批判视角的精炼 JSON。
- [x] 12. 在放大模式下显示 AI 评分与点评
  - [x] 在 `App.tsx` 中定位 `enlargedImageId` 的模态框视图。
  - [x] 查询当前放大的图片的 `evaluations[enlargedImageId]`。
  - [x] 如果存在点评数据，在图片底端渲染一个半透明的深色遮罩面板，展示分数和深度批判文本。
- [x] 13. 多模态大模型无缝切换架构 (Multi-Model Client)
  - [x] 在 `App.tsx` 的「设置」区域中加入下拉菜单，支持选择 Provider (如 OpenAI, Gemini, Qwen)。
  - [x] 将保存配置的方式升级为支持存储 Endpoint URL、Provider 类型、API Key。
  - [x] 重写 `qwenClient.ts`（可重命名为通用名称），使其根据配置分支构建 Request Payload。
  - [x] 实现针对 GPT-4o 的消息结构封装，以及使用 Gemini 独有 `inlineData` 组装图片。
- [x] 14. 全局多语言支持架构 (Global i18n Support)
  - [x] 安装并配置 `i18next` 及 `react-i18next`。
  - [x] 在 `src/i18n.ts` 集中挂载中英文(`zh-CN`, `en`)静态翻译词典数据。
  - [x] 全局替换 `App.tsx` 内所有写死的中文文案为 `t('key')` 的动态形式。
  - [x] 在「设置」弹窗增加界面语言切换的下拉框，并进行 `localStorage` 持久化。
- [x] 15. 多语言 AI 提示词适配 (Language-Aware Prompting)
  - [x] 在 `App.tsx` 中向 `manifestAestheticIntent`, `evaluateImages`, `critiqueImage` 传递当前语言环境(如 `zh` / `en`)。
  - [x] 在 `llmClient.ts` 对应的 prompt 中强迫 AI 按照用户的界面语言返回 JSON 和文本内容。
- [x] 16. 项目文档与开源准备 (Documentation & Publishing)
  - [x] 添加 `.env` 到 `.gitignore` 以防止 API Key 泄露。
  - [x] 编写包含中英双语和互相跳转锚点的规范化 `README.md`。
  - [x] 初始化本地 Git 仓库，连接远端至 `https://github.com/punkcanyang/GoodPhoto.git` 并提交初始 commit。
- [ ] 17. 商业化进阶闭环能力 (Commercialization Roadmap)
  - [x] **Lightroom / Capture One 桥接 (杀手级)**：生成对应的 XMP 伴随文件，包含 AI 的星级及颜色标签，实现导入 LR 时免筛选。
  - [x] **客户选片交付大厅 (Client Proofing)**：根据筛选结果一键生成本地或带签名的 Web 发片画廊，供客户线上二选打勾。
  - [x] **个性化摄影师审美微调 (Custom Aesthetics)**：支持自定义选择流派预设（如网红感 vs 杂志感），或开启高阶设置自主编写大模型核心判图 System Prompt。
  - [x] **人脸聚类与微表情优选 (Group Photo Assessor)**：基于连拍多张大合照，利用端侧或 AI API 识别并挑出“无人闭眼、笑容自然”的最佳定格。
  - [x] **移除水印功能**：集成 Stability AI 的图像内补全(Erase)扩展模块，允许使用者从画布直接抹除杂物并自动原生保存。

## 18. 2026-07-19 全案審閱待辦

> 審閱範圍：`GoodPhotos-Desktop`、尚未初始化完成的 `goodphotos-billing-backend`、雙 repo 契約、GitHub release/CI 與實際前端介面。既有勾選代表曾實作，不代表本次已通過完整驗收。

### P0：發佈或商用前必須處理

- [x] **REV-P0-01：避免 XMP 匯出覆寫既有 Lightroom / Capture One sidecar**
  - 證據：`src/App.tsx:336-356` 直接以原圖同名 `.xmp` 呼叫 `write_text_file`；Rust 端 `std::fs::write` 會完整覆寫檔案。
  - 改善：匯出前檢查目標檔，解析並保留既有 XMP namespace/編修資料，只更新 rating/label；解析失敗時停止該檔並提示，不得靜默覆寫。
  - 驗證：以含 Lightroom develop settings 的 fixture 匯出，確認原欄位仍在、評分更新正確；再測無 XMP、唯讀檔與損壞 XMP。
  - 完成（2026-07-26）：新增 Rust `write_xmp_rating`，sidecar 路徑只能由已授權原圖推導；既有 XMP 先驗證 XML，再保留其他 namespace/編修欄位並只更新 rating/label，以同目錄暫存檔同步後替換。損壞或唯讀 XMP 會逐檔拒絕且不改動。
  - 驗證紀錄：Rust tests 覆蓋新建、Lightroom 欄位保留、attribute 寫法、損壞檔原位不變、唯讀拒絕，共同納入 `cargo test --lib`。

- [x] **REV-P0-02：縮小 Tauri 本機檔案權限並恢復 CSP**
  - 證據：`src-tauri/capabilities/default.json:15-47` 同時允許 `/**`、`**/*` 與 `fs:read-all`；`src-tauri/tauri.conf.json:21-23` 將 CSP 設為 `null`；`src-tauri/src/lib.rs:60-88` 的自訂 command 可對任意傳入路徑讀、寫、複製與建目錄。
  - 改善：只對使用者經 dialog 選取的檔案/目錄建立 runtime scope；為自訂 command 加 canonical path、允許範圍與副檔名驗證；移除未使用的 shell plugin/權限；建立只允許自身資源、必要 `connect-src`、`data:`/`blob:` 圖片的 CSP。
  - 驗證：權限測試必須證明已授權照片可操作，而 `$HOME/.ssh`、任意絕對路徑與 `..` traversal 都被拒絕；production bundle 不得使用 `csp: null`。
  - 完成（2026-07-26）：刪除可接受任意路徑的讀、寫、複製、建目錄 commands，前端改用 dialog runtime scope 下的 Tauri fs API；Finder tag 與 XMP commands 先檢查 `fs_scope`。移除 shell plugin、`/**`/`**/*`/`fs:read-all`，並啟用限制自身資源、IPC 與本機圖片來源的 CSP。
  - 驗證紀錄：`cargo test --lib` 與 production build 通過；capability 不再包含全域路徑，`tauri.conf.json` 不再使用 `csp: null`，未授權自訂 command 由 scope check 拒絕。

- [ ] **REV-P0-03：修正匯出選片頁的持久型 HTML injection**
  - 證據：`src/utils/galleryExporter.ts:151-166` 把檔名與模型回傳的 `reasoning` 直接插入 `innerHTML`；惡意檔名或模型輸出可在分享出去的 gallery 執行腳本。
  - 改善：以 `createElement`、`textContent`、屬性 API 建 DOM，不組合 HTML 字串；輸出的 `index.html` 加嚴格 CSP，`data.js` 改成無執行性的 JSON 或內嵌轉義資料。
  - 驗證：加入 `<img onerror=...>`、`</script>`、引號與 Unicode 邊界 fixture，確認只能顯示純文字，且 CSP 阻擋 inline script。

- [ ] **REV-P0-04：重畫 official runtime 的計費信任邊界**
  - 證據：`docs/dual-repo/shared/API-CONTRACT.md` 讓 client 呼叫 `/usage/authorize` 後再回報 `/usage/settle`，卻沒有後端代跑模型的 execute/job API；client 可少報用量、不 settle，且官方 provider key 無安全放置位置。
  - 改善：由後端接受工作、依伺服器端價目預扣、呼叫 provider、依 provider usage 結算；`settle` 應是內部操作，不對桌面端開放。補上授權 TTL、失敗釋放、取消、對帳與 provider webhook/usage 稽核。
  - 驗證：重送、逾時、provider 成功但 client 斷線、重複 callback、部分失敗與退款情境皆不得重複扣款或永久占用點數。

- [x] **REV-P0-05：保護 BYOK 金鑰並移除 build-time 共用金鑰入口**
  - 證據：`src/App.tsx:119-137, 1782-1901` 把所有 API key 明文存進 WebView `localStorage`；`src/utils/llmClient.ts:97-99` 還會讀取會被 Vite 編進 bundle 的 `VITE_QWEN_API_KEY`。
  - 改善：BYOK 改存 macOS Keychain / Windows Credential Manager / Linux Secret Service，由 Rust command 取用且不回傳完整 key 到 UI；刪除 production 的 `VITE_QWEN_API_KEY` 路徑；設定頁只顯示遮罩與「更新/清除」。
  - 驗證：production JS bundle、localStorage、log、錯誤訊息與 crash report 均搜尋不到金鑰；登出/清除後系統憑證庫也沒有殘留。
  - 完成（2026-07-26）：BYOK 改由 Rust `keyring` 存取 OS credential store；WebView 只取得 `hasCredential`，模型與 Stability 請求皆由 Rust 注入金鑰並送出，完整金鑰不回傳 UI。每把憑證同時綁定儲存當下的 API origin，WebView 無法要求 Rust 把既有金鑰送往其他主機。移除 `VITE_QWEN_API_KEY` 與前端 Authorization 組裝；設定頁支援更新/刪除，舊 localStorage 金鑰僅在成功搬移後清除。
  - 驗證紀錄：production build 與 provider tests 通過；legacy config 測試確認合併後不含 `apiKey`/舊金鑰；原始碼搜尋僅保留一次性搬移讀取，Rust 端另測 HTTPS／loopback HTTP 邊界。

### P1：下一個版本優先處理

- [ ] **REV-P1-01：讓審美預設真正參與兩階段分析**
  - 證據：UI 會更新 `activeProfile`（`src/App.tsx:1207-1221`），但 `manifestAestheticIntent` 與 `evaluateImages` 的呼叫（`src/App.tsx:694,704`）都沒傳入它，因此永遠使用預設紀實 profile。
  - 改善：兩個呼叫都傳入同一次分析開始時鎖定的 profile snapshot；變更 profile/intent 後將舊 criteria 標示為過期，避免「增量分析」混用不同標準。
  - 驗證：用 mock fetch 斷言每個內建/自訂 profile 的 system prompt 與 evaluation standard 進入 payload，並測分析中切換 profile 不污染當次工作。

- [x] **REV-P1-02：修正設定視窗在一般高度無法操作**
  - 證據：實際 1280×720 巡覽量到設定卡片約 1018px 高、top `-149px`、bottom `869px`，卡片與 overlay 的 `overflow-y` 都是 `visible`；儲存/取消落在視窗外。Tauri 預設高度還只有 600px。
  - 改善：overlay 加安全邊距與 `overflow-y-auto`，卡片使用 `max-h-[calc(100vh-...)] overflow-y-auto`，標題與底部操作可 sticky；補 600/720/900px 高度與鍵盤操作。
  - 驗證：800×600、1280×720、1440×900 下皆能看見並操作儲存/取消，Tab 焦點不會跑到 modal 背後。
  - 完成（2026-07-26）：設定 dialog 改為限高 flex 版面，中段獨立捲動，標題與底部操作固定可見；補上 `role="dialog"`、`aria-modal`、標題關聯、Tab focus trap、Esc 關閉與焦點還原。
  - 驗證紀錄：實際瀏覽器在 800×600、1280×720、1440×900 驗收，dialog 皆位於 viewport 且「儲存設定」可見；720 高度中段 clientHeight 517 / scrollHeight 856，實際捲動至 scrollTop 339 後按鈕仍可見。另確認開啟時焦點位於 dialog，Esc 後 dialog 關閉並回到「偏好設定」按鈕。

- [ ] **REV-P1-03：修正 AI 擦除的座標、輸出品質與空遮罩檢查**
  - 證據：`src/App.tsx:781-819` 將整個顯示 canvas 直接縮放到影像尺寸，未處理 `object-contain` 的留白/實際繪製矩形；`src/App.tsx:822` 上傳的是 2048px JPEG 預覽而非原圖，完成後卻把它當成新的主要檔案。
  - 改善：依 rendered image rect 映射筆畫，拒絕空遮罩；明確定義服務輸出為新的衍生檔（Stability Erase 固定輸出 4MP），保留原檔、EXIF/ICC/方向資訊與可追蹤 provenance，不宣稱「原生畫質」。
  - 驗證：橫幅、直幅、方形、含 letterbox、Retina scale 與空遮罩皆有像素級測試；確認原檔永不被改寫。

- [ ] **REV-P1-04：對模型回應做 schema 與批次完整性驗證**
  - 證據：`src/utils/llmClient.ts:171-175, 350-351, 402-405, 425-428` 只做 `JSON.parse`，未檢查 score 範圍、欄位型別、重複/未知 imageId、漏回圖片或額外結果。
  - 改善：導入 runtime schema；每批結果須與輸入 ID 一對一；score clamp 應改成拒絕並重試一次結構修復，仍失敗則把該批標為可重試錯誤。
  - 驗證：針對 malformed JSON、markdown fence、0/100 邊界、NaN、重複 ID、未知 ID、少一張與多一張建立 contract tests。

- [ ] **REV-P1-05：建立可維護的 provider 相容性層與健康檢查**
  - 證據：`src/llmProviders.ts` 把 11 家服務都視為兩種 transport；官方資料顯示目前 DeepSeek API 模型已不是程式內的 `deepseek-vl2*`，Gemini 的 production stable ID 也不是目前預設的 `gemini-2.5-pro-preview-03-25`。現有 tests 只 mock 四家 URL，沒有真的驗證 vision、JSON schema、參數與模型存在性。
  - 改善：provider adapter 各自宣告 capabilities、payload、錯誤解析與限流；設定頁提供「測試連線/列出模型」；區分 verified、experimental、custom endpoint，過期預設由可版本化 manifest 維護。
  - 驗證：至少對正式支援清單做 opt-in live smoke；無 vision 或不支援 `response_format` 的模型必須在送圖前阻擋並說明。

- [ ] **REV-P1-06：初始化 billing backend 為真正可審查的私有 repo**
  - 證據：`goodphotos-billing-backend` 目前沒有 commit、remote、`.gitignore`、程式、測試或 CI，只有未追蹤的角色標記與兩份同步文件；商業化路線尚無後端實體。
  - 改善：先定技術棧與部署面，再建立 auth、ledger、idempotency、provider job、webhook、migration 與 observability 骨架；第一個 commit 應含 `AGENTS.md`、威脅模型、資料保留規範與最小 CI。
  - 驗證：乾淨 clone 可一鍵啟動 isolated test DB，並通過 ledger concurrency、idempotency、webhook signature、retry 與 migration rollback 測試。

- [ ] **REV-P1-07：在每次 PR/push 執行完整品質閘門**
  - 證據：`.github/workflows/release.yml` 只在 `v*` tag 執行，且只跑 `npm test`；不會先跑 build、`cargo check`、公開 repo guard、依賴稽核或雙 repo contract drift 檢查。
  - 改善：新增 CI workflow 跑 `npm ci`、type/build、tests、guard、獨立 target 的 `cargo check/clippy/fmt`；shared contract 產生 hash 或 schema，兩 repo 不一致即失敗。
  - 驗證：刻意製造 TypeScript error、Rust error、secret fixture 與契約 drift，CI 必須在 tag 前阻擋。

- [ ] **REV-P1-08：修補開發工具鏈弱點並鎖定 Node 版本**
  - 證據：完整 `npm audit` 回報 15 個 dev/tooling 弱點（3 high、6 moderate、6 low），包含 Vite dev-server 路徑讀取、Rollup 任意寫入與 picomatch ReDoS；README 宣稱 Node 18+，但已安裝 Vite 7.3.1 要求 Node `^20.19.0 || >=22.12.0`。
  - 改善：升級到包含修補的 Vite/Rollup/PostCSS/picomatch 相依版本，必要時更新直接依賴 constraint；新增 `engines.node`、`.nvmrc`/Volta 與 CI Node 22；開發 server 不得對不受信任網路暴露。
  - 驗證：`npm audit` 對可利用的 dev-server/build 路徑為零 high；Node 版本不符時安裝或 preflight 明確失敗。

- [ ] **REV-P1-09：穩定版 release 必須強制簽章與 notarization**
  - 證據：release workflow 在 Apple secrets 缺少時只警告，仍會發佈正式 non-prerelease；`docs/release/macos-updater-checklist.md:43-49` 卻寫成 workflow 應通過 signing secrets 驗證。v0.1.5 資產存在，但目前流程無法從 CI gate 證明 DMG 已簽章/notarize。
  - 改善：stable tag 缺任一 Apple secret 就 fail；若要保留 unsigned build，只能輸出明確標示的 draft/prerelease artifact。建置後執行 `codesign --verify --deep --strict`、`spctl --assess` 與 stapler 驗證。
  - 驗證：缺 secret 的 stable release 必敗；有 secret 時下載實際 DMG，在乾淨 macOS 帳號通過 Gatekeeper 與 updater 升級。

- [ ] **REV-P1-10：為複製、gallery 與擦除輸出建立衝突政策與原子寫入**
  - 證據：`src-tauri/src/lib.rs:66-88` 所有輸出直接寫目標；`copy_file` 會覆寫同名檔，gallery 同分鐘資料夾也會合併，UI 沒有逐檔結果、跳過或復原資訊。
  - 改善：先寫同目錄 temp file、fsync/rename；目標存在時採明確政策（跳過、重新命名、覆寫需再次確認），回傳逐檔 status；批次任一失敗時保留成功清單，不顯示籠統完成。
  - 驗證：同名、唯讀、磁碟滿、途中取消、部分失敗與重跑皆不破壞既有檔案。

- [ ] **REV-P1-11：校正文案、隱私揭露與跨平台承諾**
  - 證據：README 同時寫「全程不消耗流量」與「發往遠端接口」，React badge/技術說明仍是 18（實際 19），Node 需求錯誤，並把未經 live 驗證的 11 家 provider 都描述成完整支援；macOS Finder tag 在 Windows/Linux 實際是 silent no-op。
  - 改善：明列哪些資料會傳到哪個 provider、縮圖尺寸/格式、金鑰保存方式、資料保留與成本；功能矩陣標明 verified OS/provider；非 macOS 隱藏或停用 Finder tag 並解釋原因。
  - 驗證：README/隱私頁由程式常數或 release checklist 對照；每次 release 做 claim-to-runtime smoke，不再使用「完美適配」「100%」等無測試保證的字眼。

### P2：可維護性與產品品質

- [ ] **REV-P2-01：拆分 2,233 行 `App.tsx` 與集中工作狀態**
  - 改善：依 library/import、analysis job、viewer/eraser、settings/updater、export 拆成 hooks/service/component；用 reducer 或明確 job state 處理取消、過期結果與並行操作。
  - 驗證：切換圖片、清空、移除、分析完成與 async focus race 都有 component/integration tests，且沒有 stale closure 更新錯誤。

- [ ] **REV-P2-02：處理大型照片批次的記憶體與主執行緒壓力**
  - 證據：原檔經 JS/Tauri IPC 讀成 byte array，再轉 Blob/base64；所有 2048px JPEG 長期放在 React state，批次處理完全循序且沒有取消/上限。
  - 改善：Rust 端產生縮圖與 EXIF，前端只保留 object URL/快取索引；設 concurrency、批次上限、取消與 LRU；避免 `Array.from(bytes)` 多次複製。
  - 驗證：以 100/500 張 24MP fixture 量測 peak RSS、UI responsiveness、取消延遲與資源釋放。

- [ ] **REV-P2-03：補齊真正的功能測試矩陣**
  - 現況：只有 provider URL mock、OpenAI rate-limit 與 updater unit tests；沒有 XMP、gallery、image processor、Stability mask、Rust command、App interaction 或 release smoke 自動化。
  - 改善：先覆蓋 P0/P1 regression，再加 Tauri integration/E2E；API 測試以 fixture server 取代真實付費呼叫，live smoke 必須 opt-in。
  - 驗證：測試失敗能指向單一功能，不依共享使用者資料、真實相簿或付費 key。

- [ ] **REV-P2-04：完成 i18n、無障礙與鍵盤操作**
  - 證據：`App.tsx` 仍有多處硬編碼簡體中文、`alert()` 與無 accessible name 的 icon button；目前只有 `zh-CN`/`en`，既有「全局替換」勾選與實況不符。
  - 改善：所有使用者文案進 translation keys，新增 `zh-TW`；modal 加 dialog role、focus trap、焦點還原與 ESC 規則；以 toast/status region 取代阻塞式 alert。
  - 驗證：缺 key CI 檢查、axe、全鍵盤 happy path 與中英繁簡視覺巡覽。

- [ ] **REV-P2-05：讓雙 repo 契約成為可執行的規格**
  - 改善：把 Markdown 範例提升為 OpenAPI/JSON Schema；產生 desktop client 與 backend types；補 auth lifecycle、request ID、分頁、money/credits 精度、時間語意、重試分類與相容性政策。
  - 驗證：兩 repo 由同一 schema 產物做 contract test，破壞性變更必須 version bump 並附 migration plan。

### 需要決策（含建議）

- [x] **DEC-2026-07-19-01：既有 XMP 的處理政策**
  - 建議：採「解析後合併」；無法安全解析就跳過並提示。不要提供預設覆寫。
  - 選項：A. 合併（建議）；B. 另存 GoodPhotos 專用 sidecar/manifest；C. 備份後覆寫（仍有相容風險）。
  - 決策（2026-07-26）：採 A；已依此完成 `REV-P0-01`。

- [x] **DEC-2026-07-19-02：BYOK 與官方代跑的金鑰架構**
  - 建議：BYOK key 只進 OS credential store；官方代跑只走後端，桌面端永遠拿不到平台 provider key。
  - 選項：A. 雙模式並存（建議）；B. 全部改官方代跑；C. 只保留 BYOK、不建計費後端。
  - 決策（2026-07-26）：採 A；本次先完成 BYOK credential store 與 Rust request boundary，官方代跑仍由 `REV-P0-04` / `DEC-2026-07-19-03` 追蹤。

- [ ] **DEC-2026-07-19-03：official runtime 的 API 形態**
  - 建議：桌面端提交 job，後端內部完成 authorize → provider call → settle，client 只查 job/result；大型批次採 async job。
  - 選項：A. 非同步 job（建議）；B. 小批同步、大批 async；C. 保留 client settle（不建議）。

- [ ] **DEC-2026-07-19-04：平台支援範圍**
  - 建議：近期明確標示 macOS-first，只發佈與驗證 Apple Silicon；等檔案標籤、credential store、路徑與 installer 有 parity tests 後再承諾 Windows/Linux。
  - 選項：A. macOS-first（建議）；B. 三平台同步；C. macOS + Windows。

- [ ] **DEC-2026-07-19-05：provider 支援策略**
  - 建議：正式清單只保留有 live vision contract test 的少數 provider，其餘列為 experimental/custom endpoint；不要用同一個 OpenAI-compatible payload 宣稱完整支援。
  - 選項：A. 分 verified/experimental（建議）；B. 縮成 3–4 家；C. 維持 11 家並承擔完整測試成本。

- [ ] **DEC-2026-07-19-06：stable release 的簽章政策**
  - 建議：stable release 缺 Apple 簽章/notarization 就直接失敗；unsigned 只能是 draft/prerelease，名稱清楚警示。
  - 選項：A. stable 強制簽章（建議）；B. 允許 unsigned stable（不建議）。

- [ ] **DEC-2026-07-19-07：AI 擦除的產品承諾**
  - 建議：定位為「建立 4MP 衍生檔並保留原檔」，UI 顯示預估尺寸、格式與成本；若要原解析度，另建 tiling/upscale pipeline，不以現況宣稱原生畫質。
  - 選項：A. 4MP 衍生檔（建議）；B. 另做高解析 pipeline；C. 暫時移除擦除功能直到品質達標。
