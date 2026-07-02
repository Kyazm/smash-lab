# import-framedata

ultimateframedata.com（Ver.13.0.1）+ 検証窓スプレッドシート（日本語技名）から
`characters` / `moves` / `oos_options` を一括取込するパイプライン。一度きり実行想定（ADR-0003 / ADR-0006）。

## 実行

```bash
cd pipelines/import-framedata
npm install
npm run all        # 全工程（scrape → fetch-jp → match → build）
```

個別実行:

```bash
npm run scrape:ufd   # UFD全89キャラ + statsページ取得 → .context/import-framedata/ufd.json
npm run fetch:jp     # 検証窓シート日本語技名 → .context/import-framedata/jp.json
npm run match        # 英日技名突合 → data/imported/name-mapping.csv
npm run build        # 最終JSON + REPORT.md → data/imported/
```

`npm run scrape:ufd -- --force` / `fetch:jp -- --force` でキャッシュ無視の再取得。

## 出力

`data/imported/`（スキーマ `supabase/migrations/0001_schema.sql` の列と完全一致）:

- `characters.json` — 89体（id/slug/name_ja/name_en/fighter_number/icon_url/is_main）
- `moves.json` — 全技（startup/active/faf/on_shield/damage/hitbox_img_url 等）
- `oos_options.json` — 全キャラOoS（oos_type/extra_frames/label/range_note）
- `name-mapping.csv` — 英日技名対応表（confidence / needs_review / ai_generated フラグ付き、人間レビュー用）
- `REPORT.md` — 取込サマリー・スポットチェック・欠損統計・既知の問題

## 礼儀・キャッシュ

- 1リクエスト/秒、User-Agent 明示（`src/lib/http-cache.ts`）
- 生HTML/CSVは `.context/raw-cache/`（gitignore済）へキャッシュ。再実行時は再取得しない（先方負荷回避）
- ヒットボックス画像は**ダウンロードしない**。URLのみ保存。Storageミラーは後工程

## データソースと突合方針

| フィールド | ソース |
|---|---|
| startup/active/faf/on_shield/damage/hitbox_img_url | UFDキャラページ（`movecontainer` パース） |
| oos_options | UFDキャラページの Misc Info（`oos1-3` + Shield Grab）+ statsページでクロスチェック |
| name_ja（日本語技名） | 検証窓シート gviz CSV（`gviz/tq?tqx=out:csv`） |

英日突合（`src/lib/match-names.ts`）:

1. **スロット確定技は規則ベース生成**（弱1〜3/百裂/横強/上強/下強/横スマ/上スマ/下スマ/
   空N/空前/空後/空上/空下/ワイヤー空中攻撃/ダッシュ攻撃/つかみ系/前後上下投げ/回避）。
   英語側のカテゴリとスロットで技種が確定するため検証窓との順序マッチは使わない。
   既知の英語修飾（Luma/Cargo/シフト等）は訳語化、未知修飾は `needs_review`
2. **必殺技のみ検証窓シートの固有名を採用**（NB/横B/上B/下B の canonical 一致 = 高信頼、
   派生技は 必殺ワザ セクション内の順序補完 = `needs_review`）
3. **手動オーバーライド**: `data/overrides/name-overrides.csv`（character_slug, move_slug, name_ja）
   を build 時に最後に適用。パイプライン再実行でも消えない人力修正層

`extra_frames` は docs/02 定義の固定値: aerial=3 / up_b=0 / up_smash=0 / grab=4 / shield_drop=11 を
基本とし、UFDのOoS実効値と±2F超乖離する場合のみ **UFD値を正として (UFD実効値 − startup) に個別調整**
（多段上B・特殊ジャンプ踏切キャラ対応。調整一覧は REPORT.md）。実効発生 = `moves.startup + extra_frames`。

## 検証窓シートの罠（実測、`.context/data-sources-addendum-kenshomado.md`）

- 存在しないシート名/gid でも HTTP 200 でトップページCSVが返る → **CSV先頭のキャラ名ラベルで実在検証**
- gviz は `sheet=<URLエンコードタブ名>` で取得。タブ名は実シートと完全一致が必要
  （例: `51. 格闘Mii` / `58. クッパ Jr.`（半角空白）/ `75. ベレト／ベレス`（全角スラッシュ））
- シートは 79=ホムラ(Pyra) / 80=ヒカリ(Mythra) / 81=カズヤ を独立タブで持つ（ゲーム内番号とズレる）
- 派生キャラ7種（ダークサムス/デイジー/ルキナ/クロム/ブラックピット/ケン/リヒター）は
  `sheet=` で取れない場合、元キャラの技名をコピー（`source=derived`）
- 54番パルテナはシートに実在（当初の欠落懸念は解消。AI生成フォールバック不要）

## ソース構成

```
src/
  roster.ts            89キャラのslug/日本語名/シートタブ/gid対応表
  scrape-ufd.ts        UFDスクレイパー
  fetch-jp-names.ts    検証窓シート取得（実在検証+derived/aiフォールバック）
  match-names.ts       英日突合実行 → name-mapping.csv
  build-output.ts      最終JSON + REPORT.md 生成
  run-all.ts           全工程オーケストレータ
  lib/
    http-cache.ts      レート制限+キャッシュ付きfetch
    parse-ufd.ts       UFD HTML パーサ
    parse-jp-csv.ts    gviz CSV パーサ
    canonical-move.ts  英/日 技名の正規化キー
    match-names.ts     突合ロジック
    ai-fallback.ts     慣用日本語名の生成
    uuid.ts            決定的UUID（冪等な再取込用）
    types.ts           中間型
```
