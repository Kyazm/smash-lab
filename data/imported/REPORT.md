# import-framedata 取込サマリー

生成日時: 2026-07-02T23:14:14.049Z

取込元: ultimateframedata.com (Ver.13.0.1) + 検証窓スプレッドシート（日本語技名）
方針: ADR-0003 / ADR-0006 / docs/03 Phase 1

## 統計

- キャラ数: **89**
- 技数: **3591**
- OoS候補数: **420**
- 日本語名カバレッジ: **99.7%** (3581/3591)
- needs_review: **357** 件（順序マッチ主体の旧方式: 687件 → 規則ベース生成導入で削減）
- ai_generated: **0** 件
- 手動オーバーライド適用: **15** 件（定義 15 件）

### 日本語技名ソース内訳

- 検証窓シート実データ: 82 キャラ
- 派生キャラ（元キャラからコピー）: 7 キャラ
- AI生成フォールバック: 0 キャラ

### 欠損フィールド統計（全技中でnullの数）

| フィールド | 欠損数 |
|---|---|
| startup | 871 |
| active | 1286 |
| faf | 189 |
| on_shield | 1856 |
| damage | 1233 |
| hitbox | 892 |
| name_ja | 10 |

## スポットチェック（既知値との照合）

| チェック | 結果 | 詳細 |
|---|---|---|
| キャラ数が87前後 | ✅ OK | 89体 |
| マリオ弱1: 発生2/ガード時-14 | ✅ OK | 発生2/on_shield-14 |
| ZSS 上B OoS実効=6（UFD原典） | ✅ OK | 実効6f (startup6+extra0) |
| ZSS 掴み OoS実効=19（UFD原典: 15+4） | ✅ OK | 実効19f (startup15+extra4) |

## OoS extra_frames の個別調整

UFDのOoS実効値と docs/02 固定 extra_frames の計算が±2F超乖離した 5 件は、
**UFD値を正として extra_frames = (UFD OoS実効値 − startup) に調整**した:

- donkey_kong up_b(Up B (Spinning Kong)): extra_frames 0→-12（UFD実効7fを正として調整）
- hero up_b(Up B (Woosh/Swoosh/Kaswoosh)): extra_frames 0→3（UFD実効7fを正として調整）
- steve aerial(Sword Forward Air (Short Hop Macro FAir)): extra_frames 3→7（UFD実効11fを正として調整）
- kazuya aerial(Up Air): extra_frames 3→7（UFD実効11fを正として調整）
- kazuya aerial(Neutral Air): extra_frames 3→7（UFD実効15fを正として調整）

## 既知の問題・要確認

- OoS紐付け失敗（対応技が見つからず除外）: 20 件
- 自動検出された異常なし

## 注記

- ヒットボックス画像はURLのみ保存（ダウンロードせず）。Storageミラーは後工程。
- needs_review / ai_generated 行は data/imported/name-mapping.csv で確認可能。
- 日本語名の人力修正は data/overrides/name-overrides.csv に追記（再実行でも消えない）。
- OoS extra_frames は docs/02 定義の固定値（aerial=3/up_b=0/up_smash=0/grab=4/shield_drop=11）を
  基本とし、UFD実効値と±2F超乖離する場合のみ個別調整（上記「OoS extra_frames の個別調整」参照）。
