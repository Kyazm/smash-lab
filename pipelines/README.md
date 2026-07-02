# pipelines/（AI処理系・Macローカル）

このディレクトリは Phase 3 以降で実装する。Phase 1 ではプレースホルダのみ。

docs/02_architecture.md のとおり、閲覧系（`web/`）と AI 処理系（ここ）は Supabase を介してのみ結合する疎結合構成。パイプラインが止まっても閲覧系は動く。

## 予定するパイプライン（docs/02, docs/03）

| パイプライン | 役割 | フェーズ |
|---|---|---|
| `import-framedata` | ultimateframedata.com をスクレイプ → characters/moves/oos_options 投入（一度きり、ADR-0003 / ADR-0006） | Phase 1 のデータ投入（別途） |
| `import-discord` | Discord REST API v10 で対象カテゴリを直接エクスポート → notes/note_media へ移行（一度きり、docs/02 移行手順）**実装済み** | Phase 2 |
| `review-match` | YouTube URL 登録 → yt-dlp 取得 → Gemini 動画解析 → ai_reviews 書込（ADR-0002 / ADR-0007） | Phase 3 |
| `intel-collect` | 週次 launchd / オンデマンド検索 → intel_items 投入（ADR-0004） | Phase 4 |

## 実装上の制約（ADR-0004・コードレビュー項目）

- パイプラインは service role キー（Macローカル `.env`、git 管理外）で書き込む。service role は RLS をバイパスする。
- **パイプラインコードは `notes` テーブルへ書き込まない**。intel → notes の昇格は必ず Web UI からの `adopt_intel()` RPC 経由のみ。この禁止は DB 権限では担保されないため、コードレビューで担保する。
  - **例外: `import-discord`（一度きり移行）**。docs/02「Discord移行」で明示的に許可された、ユーザー自身の既存メモの一度きり投入は `source='discord_import'` で `notes`/`note_media` へ書き込む。この禁止が対象とするのは intel-collect / review-match の**継続的な自動書込**であり、移行の一度きり seeding は別枠（`pipelines/import-discord/src/lib/emit-sql.ts` 冒頭に根拠を明記）。継続パイプライン（review-match / intel-collect）は引き続き `notes` へ書き込まない。
- API キー・service role キーはコミット禁止。
