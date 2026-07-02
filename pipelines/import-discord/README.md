# import-discord

Discord サーバーの「キャラ対メモ / 技考察 / 立ち回りメモ」チャンネルを、
smash-lab の `notes` / `note_media` スキーマへ移行するパイプライン。**一度きり実行**想定
（docs/02「Discord移行」/ docs/01 F8）。

移行対象カテゴリ（`src/config.ts` の `TARGET_CONFIG` で変更可能）:

| カテゴリ | 判定 | ノート種別 |
|---|---|---|
| 末尾が「キャラ対策」（64キャラ対策 / DXキャラ対策 …） | 正規表現 `/キャラ対策$/` | `matchup`（チャンネル名からキャラ突合） |
| ゼロサム技 | 完全一致 | `own_move`（チャンネル名から ZSS の技を突合。未解決は `own_play`） |
| ゼロサムについて / スマブラ基本 | 完全一致 | `own_play` |

## 認証（Bot トークン推奨）

ユーザートークン（self-bot）での API 直叩きは **Discord ToS 違反**（アカウント凍結リスク）。
本パイプラインは **Bot トークンを既定**とする。ユーザーは自サーバーの管理者なので Bot を招待できる。

### Bot 作成〜招待（3行要約）

1. **Discord Developer Portal → New Application → Bot タブ**でトークンを取得し、**MESSAGE CONTENT INTENT を ON**。
2. **OAuth2 → URL Generator** で `scope=bot` / permissions=**View Channels** + **Read Message History** の招待URLを生成。
3. その URL を開き、対象サーバー（guild `958661372592418838`）へ Bot を招待する。

詳細手順:

1. https://discord.com/developers/applications → **New Application**（任意名）。
2. 左メニュー **Bot** → **Reset Token** でトークンを表示・コピー（`.env` に保存、**絶対にコミットしない**）。
3. 同じ **Bot** 画面の **Privileged Gateway Intents** で **MESSAGE CONTENT INTENT** を有効化
   （これが無いと `content` が空で返る）。
4. 左メニュー **OAuth2 → URL Generator**:
   - SCOPES: `bot`
   - BOT PERMISSIONS: `View Channels`, `Read Message History`
   - 生成された URL を開き、対象サーバーを選んで認可。
5. リポジトリ直下 `.env` に設定:

   ```
   DISCORD_TOKEN=（Botトークン）
   # 既定は Bot。省略可。
   DISCORD_TOKEN_TYPE=bot
   ```

`.env` は `.gitignore` 済み（リポジトリ直下 `.gitignore` に `.env`）。

### ユーザートークン（非推奨フォールバック）

どうしても Bot を使えない場合のみ、ブラウザ版 Discord の DevTools → Network で任意の API リクエストの
`Authorization` ヘッダ値をコピーし、`.env` に以下を設定する:

```
DISCORD_TOKEN=（ユーザートークン）
DISCORD_TOKEN_TYPE=user
```

> **警告**: ユーザートークンでの API 自動アクセス（self-bot）は Discord ToS 違反であり、
> アカウント凍結の可能性がある。自己責任。エクスポート対象は**自分のデータのみ**に限ること。

## 実行

```bash
cd pipelines/import-discord
npm install

# 1. エクスポート（Discord → .context/discord-export/）
npm run export -- --dry-run   # まず下見: 対象チャンネル一覧のみ取得（メッセージ/添付は取らない）
npm run export                # 本番: 全メッセージ + 添付をダウンロード

# 2. マッピング表生成（.context/discord-mapping.csv）
npm run transform
#   → CSV を開き、未解決の character_slug / move_slug を手で埋める（下記「マッピング確認」）

# 3. ローダー（notes.json + load.sql を生成。DBには入れない）
npm run load
```

`npm run all` は export → transform を連続実行し、CSV 確認を促して止まる（確認後に `npm run load`）。

`npm run export -- --no-attachments` で添付ダウンロードを省略（メッセージ JSON のみ）。

## マッピング確認（人間の作業）

`transform` が `.context/discord-mapping.csv` を生成する。列:

```
channel, channel_id, category, kind, character_slug, move_slug, starred, note
```

- `note` に「未解決」とある行は自動突合できなかったもの。`character_slug`（matchup）/
  `move_slug`（own_move）を手で埋める。`character_slug` は `data/imported/characters.json` の
  `slug`、`move_slug` は ZSS の `moves.json` の `slug`。
- own_move で技を特定できないチャンネル（例: 「コンボ雑談」）は `move_slug` を空のままにすると
  `own_play` ノートになる。
- `starred` は⭐付きチャンネルで自動 `true`。手で上書きも可。

CSV を確認・修正してから `npm run load` を実行する（docs/02 の設計どおり、投入前に人間が挟まる）。

## 出力

| パス | 内容 |
|---|---|
| `.context/discord-export/_channels.json` | 対象チャンネル一覧（カテゴリ・種別・件数） |
| `.context/discord-export/<channel-id>.json` | チャンネルごとの生メッセージ配列（Discord API 生 JSON） |
| `.context/discord-export/attachments/<id>_<name>` | 添付ファイル実体 |
| `.context/discord-mapping.csv` | チャンネル→ノート属性のマッピング表（人間が確認・修正） |
| `.context/discord-import/notes.json` | 投入用中間 JSON（notes + note_media を入れ子で保持） |
| `.context/discord-import/load.sql` | Supabase 投入 SQL（service role キーで**後日**実行） |

`.context/` は `.gitignore` 済み。エクスポートしたメモ・添付・トークンはコミットされない。

## 統合ルール（docs/02 移行手順）

- **1チャンネル = 1ノート**。同一チャンネル内の連続メッセージを時刻順（snowflake 昇順）に統合し、
  日付が変わるたびに `## YYYY-MM-DD` 見出しを差し込む。
- **編集済みは最終版を採用**（Discord `content` は編集後の値。`edited_timestamp` は無視）。
- **bot 投稿・システムメッセージは除外**（自分のメモ移行のため）。
- 添付**画像** → `note_media(type=image)`（Supabase Storage 想定、`storage_path`）。
  添付**動画/その他** → `note_media(type=local_video)`（ローカル保管想定、`url`）。
  本文には `attachment://<id>/<name>` プレースホルダを残す（Storage アップロード後に置換）。
- ID は決定的 UUIDv5（`src/lib/uuid.ts`）。再実行しても同じチャンネル/添付に同じ ID が振られ、
  SQL は `ON CONFLICT (id) DO NOTHING` で冪等。

## notes への書込について（ADR-0004 / コードレビュー項目）

ADR-0004 が禁じるのは **intel-collect パイプラインが `notes` へ自動書込すること**。
本パイプラインは docs/02 で明示的に許可された**ユーザー自身の既存メモの一度きり移行**であり、
`source='discord_import'`（スキーマ定義済みの enum 値）で入る。intel 由来ではないため、
`notes` / `note_media` への INSERT はこのパイプラインでのみ許容される（`src/lib/emit-sql.ts` 冒頭に明記）。

## 添付ファイルの投入（DB準備後）

`load` は添付の**参照**を note_media に記録するのみ。実体アップロードは DB/Storage 準備後に別途:

- 画像: `.context/discord-export/attachments/` → Supabase Storage の `discord/<id>_<name>` へアップロードし、
  `note_media.storage_path` と一致させる。
- 動画: ローカル保管ディレクトリへ回収（YouTube 限定公開化は必要時に手動。docs/02 メディア戦略）。

## 注意

- **トークンは絶対にコミットしない**（`.env`、`.gitignore` 済み）。
- エクスポートは**自分のデータのみ**。
- レート制限を遵守する（`src/lib/discord-api.ts`: 429 の `retry_after` 尊重 + `X-RateLimit` 自主スロットル + User-Agent 明示）。

## ソース構成

```
src/
  config.ts            対象カテゴリ・ギルドID・出力パス・カテゴリ分類
  export.ts            exporter（Discord API → 生JSON + 添付）
  transform.ts         transformer（対象一覧 → discord-mapping.csv）
  load.ts              loader（確認済みCSV + メッセージ → notes.json + load.sql）
  run-all.ts           export → transform オーケストレータ
  lib/
    discord-api.ts     REST v10 クライアント（Bot認証・レート制限・ページネーション）
    select-channels.ts カテゴリ構造 → 対象テキストチャンネル選別
    match-channel.ts   チャンネル名 → character_slug / move_slug / starred 突合
    merge-messages.ts  連続メッセージ → 1ノート統合（日付見出し・編集最終版・添付）
    mapping-csv.ts     マッピングCSVの生成/パース（RFC4180）
    build-notes.ts     マッピング + メッセージ → OutNote[]
    emit-sql.ts        OutNote[] → notes/note_media INSERT SQL（冪等）
    uuid.ts            決定的UUIDv5（冪等な再投入用）
    io.ts              fs ヘルパー
    types.ts           Discord API 部分型 + 中間/出力型
test/
  fixtures/            架空の Discord API レスポンス（guild-channels / messages-*）
  *.test.ts            vitest（突合・統合・CSV往復・ノート生成・SQL）
```

## テスト

```bash
npm test
```

実トークン不要。フィクスチャ（`test/fixtures/`）と `data/imported/` の実データで全ロジックを検証する
（チャンネル分類・選別、キャラ/技突合、メッセージ統合、CSV往復、ノート生成、SQL生成）。
