# 文件預覽與 ChatGPT 收據匯入設計規格

日期：2026-07-12
狀態：使用者已核准設計，待書面規格審閱

## 1. 目標

本次調整包含兩項：

1. 修復 iPhone Safari 無法穩定開啟 Firebase Storage 文件的問題。
2. 新增 ChatGPT 收據辨識結果匯入，經使用者確認後，才寫入 Firebase 記帳。

本次不讓公開的 GitHub Pages 保存 OpenAI API 金鑰，也不會讀取 ChatGPT 對話歷史。

## 2. 方案選擇

採用「目前頁面預覽＋JSON 貼上匯入」。這是不增加後端密鑰、又能支援過去 ChatGPT 辨識結果的最小完整方案。

未採用方案：

- 預先開啟空白新分頁，再導向 Storage URL：可保留原頁，但 iPhone Safari 仍可能限制或產生空白頁。
- 透過 ChatGPT Action 直接寫入：自動化程度高，但需另建可驗證身分的 API 後端，不符合目前靜態網站的架構。
- 在網站內直接呼叫 AI 辨識：操作最短，但需增加安全後端、費用管理與輸入內容保護。

## 3. 文件預覽

### 3.1 根因

現行程式先非同步取得 Firebase Storage 下載網址，再呼叫 `window.open()`。iPhone Safari 可將這個呼叫視為非使用者直接觸發的彈出視窗，因而阻擋。

### 3.2 新行為

- 點擊「預覽」後，先取得 Storage 下載網址。
- 以目前頁面導向該網址，不開啟新分頁。
- 使用者按瀏覽器「返回」回到系統。
- 取得網址失敗時，維持在原頁並顯示「文件開啟失敗，請重試」。
- 收據預覽採相同方式，避免同樣的 Safari 限制。

## 4. ChatGPT 輸出合約

ChatGPT 必須只輸出 JSON，不可附加 Markdown 程式碼框或解釋文字。

```json
{
  "version": 1,
  "expenses": [
    {
      "date": "2026-07-13",
      "merchant": "一蘭拉麵",
      "amount": 2480,
      "currency": "JPY",
      "category": "餐飲",
      "description": "晚餐",
      "items": [
        { "name": "拉麵", "quantity": 2, "amount": 1960 },
        { "name": "加點", "quantity": 1, "amount": 520 }
      ],
      "confidence": 0.96,
      "notes": ""
    }
  ]
}
```

### 4.1 欄位規則

- `version`：必須是數字 `1`。
- `expenses`：必須是陣列，一次最多 50 筆。
- `date`：`YYYY-MM-DD`；空字串視為待使用者補正。
- `merchant`：店家名稱，最長 100 字。
- `amount`：大於 0 的有限數字。
- `currency`：只允許 `JPY` 或 `TWD`。
- `category`：只允許「餐飲、交通、住宿、購物、門票、其他」。
- `description`：費用摘要，最長 200 字。
- `items`：可為空陣列；每筆品項含 `name`、`quantity` 與 `amount`。
- `confidence`：0 至 1 的數字。
- `notes`：辨識疑問，最長 300 字。

JSON 之外的欄位一律忽略，不寫入 Firestore。

## 5. 匯入使用流程

1. 使用者在 ChatGPT App 上傳一張或多張收據。
2. 使用者貼上系統提供的提示詞。
3. ChatGPT 依第 4 節格式產生 JSON。
4. 使用者將 JSON 貼入「匯入 ChatGPT 辨識結果」。
5. 系統解析後顯示待匯入清單，不立即寫入 Firebase。
6. 使用者可修改日期、店家、金額、幣別、分類與說明。
7. 全部資料通過檢查後，使用者按「確認匯入」。
8. 系統逐筆寫入 Firestore，並顯示成功與失敗數量。

日期映射為 7/13 至 7/17，對應 `day` 0 至 4。旅遊日期以外的資料必須由使用者修正，不自動歸到最接近日期。

## 6. 匯率與記帳欄位轉換

現有記帳以 `jpy` 作為總計基礎。匯入後增加原始金額欄位：

- `originalAmount`：ChatGPT 結果的 `amount`。
- `originalCurrency`：`JPY` 或 `TWD`。
- `jpy`：系統總計使用的日圓金額。
- `importSource`：固定為 `chatgpt-json-v1`。
- `merchant`、`items`、`confidence`、`importNotes`：保留辨識明細。

JPY 資料的 `jpy` 等於原始金額。TWD 資料依確認匯入當下的系統匯率換算為 JPY，並保留原始新臺幣金額。系統不在匯率後續更新時回頭改寫舊帳。

## 7. 重複資料提醒

系統用下列值產生比對鍵：

`date + merchant + amount + currency`

待匯入資料若與現有記帳相同，或在同一批 JSON 內重複，畫面顯示警告。使用者可取消該筆，也可確認仍要匯入。此機制是提醒，不是不可繞過的限制。

## 8. 驗證與錯誤處理

- JSON 無法解析：顯示「無法讀取 JSON，請確認沒有貼入程式碼框或其他文字」。
- 版本不支援：顯示目前版本與支援版本。
- 單筆欄位錯誤：標示第幾筆及欄位，不允許確認匯入。
- 金額或匯率無效：不寫入 Firebase。
- Firebase 單筆寫入失敗：保留未成功資料，允許重試；已成功資料不再重送。
- 一次最多匯入 50 筆，避免誤貼大量內容造成異常寫入。

## 9. Firebase 資料與安全規則

Firestore `expenses` 文件擴充可選欄位：

- `originalAmount: number`
- `originalCurrency: "JPY" | "TWD"`
- `importSource: "chatgpt-json-v1"`
- `merchant: string`
- `items: array`
- `confidence: number`
- `importNotes: string`

規則必須檢查欄位型別、字串長度、陣列大小、品項結構、金額範圍及允許欄位。建立與更新使用相同驗證，避免先建立合法文件，再更新成不合法狀態。寫入權限維持現有的兩個白名單 Google 帳號。

本次不新增 Storage 路徑。ChatGPT App 中的收據影像不會因 JSON 匯入而自動複製到 Firebase Storage。

## 10. 介面

記帳頁新增一個可收合區塊：

- 標題：「匯入 ChatGPT 辨識結果」。
- 包含「複製 ChatGPT 提示詞」按鈕。
- 包含 JSON 多行輸入欄與「檢查資料」按鈕。
- 檢查後顯示可編輯的待匯入清單。
- 重複、低信心值（低於 0.7）與必填欄位不完整者使用醒目標記。
- 完成匯入後清除輸入內容，並在當日記帳清單中顯示新資料。

## 11. 測試與驗收

### 11.1 自動測試

- 文件與收據預覽不再呼叫 `window.open()`。
- 有效單筆與多筆 JSON 可通過驗證。
- 非 JSON、錯誤版本、錯誤日期、幣別、分類與金額會被拒絕。
- TWD 能依當下匯率換算為 JPY，並保留原始金額。
- 可找出現有記帳與批次內的重複資料。
- Firestore 規則拒絕額外欄位、錯誤型別、過長文字與過大品項陣列。
- 多筆匯入的部分失敗可重試，不重送已成功資料。

### 11.2 瀏覽器驗收

- iPhone Safari 點擊文件後，目前頁面開啟文件，按返回可回系統。
- 收據預覽亦採相同行為。
- 貼入 ChatGPT 範例 JSON，可編輯、確認並匯入。
- 另一個白名單帳號能即時看到新記帳。
- 重新整理後，匯入資料仍完整保留。
