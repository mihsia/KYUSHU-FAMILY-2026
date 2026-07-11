# 九州親子遊 Firebase 多人共享設計規格

日期：2026-07-12
狀態：已完成設計確認，待使用者審閱規格

## 1. 目標

在保留現有單一 `index.html`、既有視覺與 GitHub Pages 發布方式的前提下，加入 Firebase Google 登入與家庭多人共享功能。核准成員登入後，共用同一趟九州旅行的清單、行李狀態、旅費、匯率與旅行文件，並可即時看見其他成員的更新。

## 2. 已確認需求

- Firebase 專案：`kyushu-family-2026`
- Firebase Web App ID：`1:587703256348:web:008781d9569644555126d9`
- 多人模式：所有成員共用同一份旅行資料
- 存取方式：Google Authentication
- 存取限制：指定 Google 帳號白名單
- 管理者：`mihsia@gmail.com`
- 成員：`pandora0119@gmail.com`
- 共用文件：啟用，使用 Firebase Storage
- 舊資料：管理者首次登入時，將目前瀏覽器的 `localStorage` 資料匯入雲端
- 發布方式：保留 GitHub Pages，從 `main` 分支根目錄發布

## 3. 方案選擇

採用「保留單一 HTML，直接整合 Firebase Web SDK」。

未採用的方案：

- 重建為 Vite／React 專案：長期結構較清楚，但需要拆解約 6.5 MB 的既有單檔網站，改動與回歸風險過高。
- Firebase Realtime Database：可同步資料，但清單、旅費、成員與文件中繼資料較適合 Firestore 的文件模型。

## 4. 系統架構

- GitHub Pages：提供靜態網站與現有 `index.html`
- Firebase Authentication：Google 彈出式登入、登入狀態與登出
- Cloud Firestore：成員資料、旅行共用狀態、清單、行李與旅費
- Firebase Storage：機票、住宿、VJW、保險與其他文件
- Firestore Security Rules：限制資料讀寫對象
- Storage Security Rules：限制文件讀寫對象、檔案大小與內容類型

網站必須先取得有效登入狀態並通過白名單檢查，才可顯示旅行內容或建立 Firestore／Storage 監聽。

## 5. 資料模型

固定旅行 ID 為 `kyushu-2026`。

### 5.1 旅行根資料

`trips/kyushu-2026`

- `rate`：日圓換算匯率
- `initialized`：是否完成首次雲端初始化
- `initializedBy`：執行初始化的管理者 UID
- `initializedAt`：伺服器時間
- `updatedAt`：最後更新時間

### 5.2 共用集合

- `trips/kyushu-2026/wishlist/{itemId}`：願望清單
- `trips/kyushu-2026/mustbuy/{itemId}`：必買清單
- `trips/kyushu-2026/packing/{itemId}`：行李勾選狀態
- `trips/kyushu-2026/expenses/{expenseId}`：旅費紀錄
- `trips/kyushu-2026/documents/{documentId}`：文件中繼資料

清單與旅費文件至少記錄 `createdBy`、`createdAt`、`updatedBy`、`updatedAt`。旅費另記錄日期、分類、說明與日圓金額。文件中繼資料記錄分類、顯示名稱、Storage 路徑、內容類型、大小、上傳者與上傳時間。

### 5.3 成員

`members/{uid}`

- `email`
- `displayName`
- `photoURL`
- `role`：`admin` 或 `member`
- `lastLoginAt`

成員文件用於介面顯示與稽核；真正的存取保護不能只依賴前端或可由用戶端任意修改的角色欄位。

### 5.4 文件檔案

Storage 路徑：`trips/kyushu-2026/documents/{documentId}/{safeFileName}`。

Firestore 只保存文件中繼資料，不保存 base64 內容。檔案上傳成功後才建立中繼資料，刪除時先標記操作並確保 Storage 與 Firestore 最終一致。

## 6. 身分與權限

允許帳號：

- `mihsia@gmail.com`：管理者
- `pandora0119@gmail.com`：一般成員

規則要求：

- 未登入者不能讀寫 Firestore 或 Storage。
- 非白名單 Google 帳號不能讀寫任何旅行資料或文件。
- 兩位核准成員皆可新增、修改、刪除旅行共用內容。
- 管理者角色保留成員管理能力；第一版的白名單仍在安全規則與受控設定中明確定義，避免一般成員自行提升權限。
- 前端的隱藏或停用按鈕只改善體驗，不視為安全控制。
- 正式網域 `mihsia.github.io` 與本機測試網域必須列入 Firebase Authentication Authorized Domains。

Firebase Web 設定值可出現在前端；資料安全由 Authentication、Firestore Rules 與 Storage Rules 共同保護。

## 7. 登入體驗

1. 網站載入後先顯示 Google 登入畫面，不先顯示旅行內容。
2. 使用者按下 Google 登入，完成後驗證 Email 是否在白名單。
3. 核准成員進入既有網站，頁面顯示頭像、姓名、角色、同步狀態與登出按鈕。
4. 非白名單帳號看到「此帳號未獲邀請」，可登出並更換帳號。
5. 登出後立即解除資料監聽、清除記憶體中的共用資料並回到登入畫面。

## 8. 首次資料遷移

只有管理者可執行首次遷移。

1. 管理者登入後讀取 `trips/kyushu-2026`。
2. 若 `initialized` 已為 `true`，直接載入雲端資料，不再匯入。
3. 若尚未初始化，讀取既有 `localStorage`。
4. 願望清單、必買清單、行李狀態、旅費與匯率分批寫入 Firestore。
5. 舊文件逐一由 data URL 轉為 Blob，上傳至 Storage；每個檔案成功後才建立 Firestore 文件紀錄。
6. 全部結構化資料完成後，以交易或具前置條件的寫入設定 `initialized: true`，防止重複匯入。
7. 部分文件失敗時保留失敗清單供重試，不刪除 `localStorage` 原始資料。

若 Firestore 尚未初始化但管理者瀏覽器沒有舊資料，使用現有應用程式的預設清單建立初始雲端資料。

## 9. 即時同步與衝突

- 使用 Firestore snapshot listeners 監聽旅行根資料與各子集合。
- 清單、旅費、文件採每筆一份 Firestore 文件，避免修改整包狀態造成大量互相覆蓋。
- 行李勾選以固定項目 ID 儲存狀態。
- 每次寫入顯示「同步中」，伺服器確認後顯示「已同步」。
- 斷線時保留目前畫面並顯示離線提示；恢復連線後由 SDK 重新同步。
- 同一欄位同時修改時採最後成功寫入者為準。
- 寫入失敗時回復或重新讀取該筆雲端資料，並顯示可理解的錯誤訊息。

## 10. 文件限制與處理

- 允許常用旅行文件與圖片格式，例如 PDF、JPEG、PNG、WebP。
- 單檔大小上限在實作時固定為 10 MB，前端與 Storage Rules 使用相同限制。
- 檔名顯示使用原始名稱；Storage 路徑使用安全化檔名與不可碰撞的文件 ID。
- 預覽時取得受 Firebase Rules 保護的下載 URL 或 Blob。
- 刪除操作同時處理 Storage 檔案與 Firestore 中繼資料；任一步驟失敗時顯示重試狀態。

## 11. 錯誤與狀態

介面至少區分：

- 尚未登入
- 正在驗證
- 帳號未獲邀請
- 正在載入雲端資料
- 正在同步
- 已同步
- 離線
- 同步失敗，可重試
- 文件上傳進度與個別失敗項目

錯誤訊息不得顯示權杖、完整 Firebase 內部回應或其他敏感資訊。

## 12. 測試與驗收

### 12.1 身分驗證

- 兩個核准帳號皆可登入、登出與重新登入。
- 非白名單帳號無法看見或讀取旅行資料。
- 未登入狀態無法直接呼叫 Firestore 或 Storage 取得資料。

### 12.2 資料同步

- 兩個核准帳號同時開啟正式網站，一方新增、勾選、修改或刪除後，另一方不重新整理即可看到更新。
- 願望清單、必買清單、行李、旅費與匯率皆通過同步測試。
- 管理者首次遷移只執行一次，重新登入不產生重複資料。

### 12.3 文件

- 可上傳、預覽、刪除允許格式且不超過 10 MB 的文件。
- 過大或不允許格式會在前端與 Storage Rules 兩層遭拒。
- 部分上傳失敗不會清除原始瀏覽器資料，且可辨識失敗項目。

### 12.4 安全規則

- 使用 Emulator 或規則測試覆蓋未登入、白名單管理者、白名單成員與非白名單帳號。
- 驗證一般成員不能自行修改角色或新增白名單帳號。
- 驗證其他旅行 ID 或非預期路徑預設拒絕。

### 12.5 發布

- 本機測試通過後提交至 GitHub `main`。
- GitHub Pages 完成建置後，以 `https://mihsia.github.io/KYUSHU-FAMILY-2026/` 驗證登入、同步與文件功能。
- 保留既有 `localStorage` 作為遷移備份，不主動清除。

## 13. 不在本次範圍

- 重建或拆分現有前端框架
- 多趟旅行管理
- 公開註冊、邀請碼或匿名使用
- 複雜角色層級與逐項權限
- 推播通知、聊天室或活動紀錄介面
- 自動壓縮或 OCR 文件

## 14. 完成標準

兩個指定 Google 帳號能從正式 GitHub Pages 網址登入，共同即時使用清單、行李、旅費、匯率與文件；非白名單帳號無法讀取資料；管理者的既有本機資料成功且僅一次遷移；安全規則與正式環境驗證全部通過。
