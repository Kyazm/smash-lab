# pipelines/（AI処理系・Macローカル）

このディレクトリは Phase 3 以降で実装する。Phase 1 ではプレースホルダのみ。

docs/02_architecture.md のとおり、閲覧系（`web/`）と AI 処理系（ここ）は Supabase を介してのみ結合する疎結合構成。パイプラインが止まっても閲覧系は動く。

## 予定するパイプライン（docs/02, docs/03）

| パイプライン | 役割 | フェーズ |
|---|---|---|
| `import-framedata` | ultimateframedata.com をスクレイプ → characters/moves/oos_options 投入（一度きり、ADR-0003 / ADR-0006） | Phase 1 のデータ投入（別途） |
| `import-discord` | Discord REST API v10 で対象カテゴリを直接エクスポート → notes/note_media へ移行（一度きり、docs/02 移行手順）**実装済み** | Phase 2 |
| `review-match` | YouTube URL+タイムスタンプ登録 → yt-dlp区間取得 → ffmpegフレーム抽出 → Claude Codeセッションが分析 → ai_reviews 書込（ADR-0007 / ADR-0019） | 実装中（Phase 3） |
| `intel-collect` | 週次 launchd / オンデマンド検索 → intel_items 投入（ADR-0004） | Phase 4 |

`review-match` は prepare（動画取得・フレーム抽出・MANIFEST生成の決定論的処理）と submit（Claude Codeの分析結果をスキーマ検証・集約してai_reviews更新）の2段CLIで構成する。LLM呼び出しはパイプラインコードに含まれない（詳細: docs/13_match-review.md）。

### review-match の使い方

`cd pipelines/review-match` で以下を実行する（npm lifecycle 衝突回避のため `prepare` ではなく `prep`）。

```
npm run prep                                  # pending 1件をclaim(→processing)→動画処理→作業ディレクトリ生成
npm run prep -- --all                         # 該当pending全件
npm run prep -- --retry                        # error 行を再処理
npm run prep -- --retry-stale                  # 1時間超 processing の座礁行を再処理
npm run dry-run -- --url <URL> --t 93,210[,…]  # DB書込なし。MANIFEST生成まで（habit_tagsはread-only）
npm run submit -- <review_id> [--file <path>]  # result.json 検証+集約→ai_reviews(done)。成功時のみ作業Dir削除
npm run fail -- <review_id> --message "…"       # status=error+error_message。作業Dirは残す
```

作業ディレクトリ `<repo>/.context/review-match/<review_id>/`（dry-runは `dry-run-<videoId>/`）:

```
MANIFEST.json                       # リクエストメタ・場面窓・各フレーム{path,t_sec}・focus_points・habit_tags語彙・出力契約
frames/scene_<i>/frame_<n>.jpg      # 場面ごとの抽出フレーム（640px幅、tSec順、≤24枚/場面）
result.json                         # Claude Codeセッションが書く分析結果（submitの検証対象。prepは生成しない）
```

処理フロー: `prep` で MANIFEST とフレームを生成 → Claude Code セッションがフレームを Read し方法論（docs/13）で分析して `result.json` を書く → `submit` で検証・集約して `ai_reviews` を done 更新。中断・放棄時は `fail` で error に戻す（processing 座礁防止）。

## 実装上の制約（ADR-0004・コードレビュー項目）

- パイプラインは service role キー（Macローカル `.env`、git 管理外）で書き込む。service role は RLS をバイパスする。
- **パイプラインコードは `notes` テーブルへ書き込まない**。intel → notes の昇格は必ず Web UI からの `adopt_intel()` RPC 経由のみ。この禁止は DB 権限では担保されないため、コードレビューで担保する。
  - **例外: `import-discord`（一度きり移行）**。docs/02「Discord移行」で明示的に許可された、ユーザー自身の既存メモの一度きり投入は `source='discord_import'` で `notes`/`note_media` へ書き込む。この禁止が対象とするのは intel-collect / review-match の**継続的な自動書込**であり、移行の一度きり seeding は別枠（`pipelines/import-discord/src/lib/emit-sql.ts` 冒頭に根拠を明記）。継続パイプライン（review-match / intel-collect）は引き続き `notes` へ書き込まない。
- API キー・service role キーはコミット禁止。
