# fixtures（プレースホルダデータ）

`characters.json` / `moves.json` / `oos_options.json` の値は **すべてプレースホルダ** です。
Phase 1 のUI骨格・確定反撃エンジンの結合確認・vitest/vite buildの動作確認を目的とした仮データであり、
実際のフレームデータ（ultimateframedata.com Ver.13.0.1）とは一致しません。

後続の `import-framedata` パイプライン（Phase 2以降）実行時に、ここでの値は実データへ置換されます。

## 収録キャラ

- `zss`（ゼロスーツサムス）… `is_main = true`（使用キャラ）
- `mario`（マリオ）
- `fox`（フォックス）

## スキーマ整合

各JSONの列は `supabase/migrations/0001_schema.sql` の対応テーブル列と完全一致させています。
`id` は固定UUID文字列（採番済み）。`moves.character_id` は `characters.id`、`oos_options.move_id` は `moves.id` を参照します。

## OoS（oos_options）について

3キャラすべてに OoS 候補を持たせています。守りモード（相手技→ZSSのOoS）・攻めモード（ZSS技→相手のOoS）双方の結合確認のため。
`extra_frames` は docs/02_architecture.md の定義に整合:

| oos_type | extra_frames |
|---|---|
| aerial | 3 |
| up_b | 0 |
| up_smash | 0 |
| grab | 4 |
| shield_drop | 11 |

各キャラ最低1件 `shield_drop` を含む（UIの「ガード解除反撃も表示」トグルのデフォルト非表示確認用）。
