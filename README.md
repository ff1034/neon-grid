# NEON GRID：霓虹競技場（連線版）

瀏覽器第一人稱競技遊戲。電腦用鍵盤滑鼠，手機與平板用觸控操作。
遊戲網頁與對戰伺服器都部署在 Cloudflare Workers，伺服器使用一個 Durable Object 作為唯一的對戰房間。

## 規則

- 一次只開一場，最多 8 人自由競技。滿 2 人後倒數 10 秒開戰，局長 5 分鐘或先達 20 分。
- 場上滿了，新玩家自動排隊。排隊期間可以先玩單人練習（對戰機器人）。
- 輪到你時畫面上方會通知，15 秒內按「加入」（電腦也可按 Enter）。錯過會重新排到隊尾。
- 每場結束後，排隊的人優先上場，剛打完的玩家依名次排到他們後面。沒人排隊就全員續打。
- 命中、護盾、重生與比分全部由伺服器判定。瀏覽器只送出操作，移動有本地預測與校正。

## 部署步驟

需要：Cloudflare 帳號（免費方案即可）、電腦安裝 Node.js 20 以上。

```bash
cd neon-grid-online
npm install            # 安裝 Wrangler（已鎖定版本 4.148.0）
npx wrangler login     # 開瀏覽器登入 Cloudflare
npm run dev            # 本機測試：開 http://localhost:8787
npm run deploy         # 正式部署
```

部署完成會顯示網址，例如 `https://neon-grid.你的子網域.workers.dev`。第一次部署時 Wrangler 可能會請你建立 workers.dev 子網域，照提示操作即可。把網址傳給朋友就能一起玩。

想用自己的網域：Cloudflare 後台 → Workers & Pages → neon-grid → Settings → Domains & Routes 新增。

伺服器狀態可以開 `/status` 查看（場上人數、排隊人數、比賽狀態）。

## 專案結構

```
neon-grid-online/
  wrangler.toml        Worker、靜態資源與 Durable Object 設定
  package.json
  src/worker.js        Worker 入口與 Arena 房間伺服器（權威判定、排隊、輪替）
  public/index.html    遊戲畫面與介面
  public/game.js       3D 畫面、音效、單人模式、連線與觸控操作
  public/shared.js     伺服器與瀏覽器共用：地圖、物理、武器、比賽參數
```

## 常改的參數（public/shared.js）

- `MATCH`：局長 `time`（秒）、分數上限 `score`、開戰倒數 `countdown`、結算時間 `results`、最少開戰人數 `minPlayers`、邀請確認秒數 `offerSec`。
- `MAX_PLAYERS`：一場人數上限（預設 8）。
- `MAX_QUEUE`：排隊上限（預設 64）。
- `SEND_EVERY`：每幾個 1/60 秒的操作打包送出一次。預設 3，即每秒 20 則訊息。

修改 `shared.js` 後請把 `VERSION` 加 1。舊頁面連線時會被提示重新整理，避免新舊規則混用。

## 免費額度估算

Durable Objects 免費方案每天 10 萬次請求、13,000 GB-s，UTC 00:00（台灣早上 8 點）重置。
玩家送進伺服器的 WebSocket 訊息每 20 則算 1 次請求，伺服器送出的訊息不計費；網頁本身是靜態資源，不計入。

本專案每位玩家每秒送約 20 則操作（加上每 2 秒 1 則延遲回報），約等於每秒 1 次請求：

| 場上人數 | 每天約可玩 |
| --- | --- |
| 4 人 | 約 7 小時 |
| 8 人 | 約 3.4 小時 |

只開著網頁、在排隊或玩單人模式的人，只有延遲回報，用量很小。超過額度當天會無法連線，不會自動扣款。

## 已知限制

- 沒有延遲補償：瞄準以伺服器當下位置判定，延遲高時需要提前量。
- 房間建在第一位連線者附近的機房，跨國遊玩延遲會比較高。
- 只有基本防護（訊息頻率、大小、射速、移動速度上限），不是完整反作弊。
- three.js 與字型從 CDN 載入。
