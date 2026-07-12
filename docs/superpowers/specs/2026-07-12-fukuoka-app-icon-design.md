# 九州福岡 App 圖示設計規格

日期：2026-07-12
狀態：使用者已核准視覺方向，待書面規格審閱

## 1. 目標

為「九州親子遊 2026」製作一組海風福岡圖示。使用者在 iPhone Safari 選擇「分享 → 加入主畫面」時，iOS 應直接採用這組圖示。

同時補齊一般瀏覽器與 PWA 所需的圖示、manifest 與 iOS 顯示設定。

## 2. 方案選擇

採用 A「海風福岡」。主體為福岡塔，搭配博多灣海浪與珊瑚紅夕陽。

未採用方案：

- B「博多祭典」：色彩醒目，但祭典燈籠對福岡城市的辨識度較低。
- C「九州一家人」：家庭主題明確，但縮小後人物與島形容易變得難以辨識。

## 3. 視覺設計

### 3.1 構圖

- 正方形底圖，不預先裁成圓角。
- 中央為簡化的福岡塔，自上而下延伸，形成明確主體。
- 右上方為珊瑚紅夕陽，不與塔身重疊。
- 下方為兩層博多灣海浪，用簡單弧線表現。
- 四邊保留至少 12% 安全邊界，避免 iOS 圓角遮住主體。

### 3.2 色彩

- 主背景：深青 `#12363D`。
- 陰影或深色層：`#0C2930`。
- 福岡塔：暖白 `#F7F1E8`。
- 海浪：青綠 `#69C9BD` 與淺青 `#B8E5DE`。
- 夕陽：珊瑚紅 `#F06450`。
- 可使用少量暖沙色 `#F2D3A2` 增加夏日感。

色系必須與現有網站的深青、青綠與珊瑚色一致。

### 3.3 風格

- 簡約幾何插畫，具有高對比和清楚色塊。
- 圖示內不放任何文字、字母、日期或標語。
- 不使用照片寫實、3D 材質、細密網格或視覺雜訊。
- 不加透明背景、投影、圖示外框、裝置圓角或裝置光澤。

## 4. 圖像產製

### 4.1 母圖

- 用 imagegen 內建圖像工具產生 `1024 × 1024` PNG 母圖。
- 母圖使用不透明 RGB/RGBA 背景；所有邊角必須為實心深青色。
- 母圖儲存為 `assets/icons/fukuoka-app-icon-1024.png`。

### 4.2 衍生檔案

自母圖以高品質縮放產生：

- `apple-touch-icon.png`：180 × 180。
- `icon-192.png`：192 × 192。
- `icon-512.png`：512 × 512。
- `favicon-32.png`：32 × 32。

所有圖檔使用 PNG。圖像不先裁圓角，也不需要透明通道。

## 5. 網站整合

### 5.1 HTML 標籤

`index.html` 外層 `<head>` 新增：

```html
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#12363D">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="九州親子遊">
```

網站的 bundled template `<head>` 也必須包含相同設定，避免引導器重建內頁後遺失 metadata。

### 5.2 Web App Manifest

新增 `manifest.webmanifest`：

```json
{
  "name": "九州親子遊 2026",
  "short_name": "九州親子遊",
  "start_url": "/KYUSHU-FAMILY-2026/",
  "scope": "/KYUSHU-FAMILY-2026/",
  "display": "standalone",
  "background_color": "#12363D",
  "theme_color": "#12363D",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

## 6. iPhone 使用行為

使用者透過 Safari 進入正式網址，選擇「分享 → 加入主畫面」。主畫面圖示應顯示海風福岡圖稿，名稱預設為「九州親子遊」。

從主畫面啟動後，網站以 standalone 模式開啟。這項設定不變更 Google 登入、Firebase 同步、GitHub Pages 子路徑或現有頁面導覽。

## 7. 快取與更新

iOS 可能快取舊圖示。測試新版時，必須先刪除舊的主畫面圖示，再從 Safari 重新加入。只重新整理網頁，不一定會更新 iOS 已儲存的圖示。

## 8. 測試與驗收

### 8.1 檔案檢查

- 母圖為 1024 × 1024，衍生圖檔尺寸各自正確。
- 所有邊角不透明，且為深青色。
- 32 × 32 圖示仍能辨識塔、夕陽與海浪三個主要形狀。
- `manifest.webmanifest` 可解析，且所有 icon 路徑存在。

### 8.2 網站檢查

- 外層與 bundled template 都含 Apple Touch Icon、manifest 與 iOS metadata。
- 建置指令可重複執行，不會製造重複標籤。
- 正式 GitHub Pages 可回應所有圖檔與 manifest。

### 8.3 iPhone Safari 驗收

- 刪除舊主畫面圖示後，重新加入。
- 加入前的預覽顯示海風福岡圖示。
- 主畫面名稱預設為「九州親子遊」。
- 啟動後不顯示 Safari 一般工具列，且 Google 登入與 Firebase 同步維持正常。
