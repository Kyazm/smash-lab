# import-framedata 取込サマリー

生成日時: 2026-07-02T22:57:08.574Z

取込元: ultimateframedata.com (Ver.13.0.1) + 検証窓スプレッドシート（日本語技名）
方針: ADR-0003 / ADR-0006 / docs/03 Phase 1

## 統計

- キャラ数: **89**
- 技数: **3591**
- OoS候補数: **420**
- 日本語名カバレッジ: **99.9%** (3588/3591)
- needs_review: **687** 件
- ai_generated: **3** 件

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
| name_ja | 3 |

## スポットチェック（既知値との照合）

| チェック | 結果 | 詳細 |
|---|---|---|
| キャラ数が87前後 | ✅ OK | 89体 |
| マリオ弱1: 発生2/ガード時-14 | ✅ OK | 発生2/on_shield-14 |
| ZSS 上B OoS実効=6（UFD原典） | ✅ OK | 実効6f (startup6+extra0) |
| ZSS 掴み OoS実効=19（UFD原典: 15+4） | ✅ OK | 実効19f (startup15+extra4) |

## 既知の問題・要確認

- OoS紐付け失敗（対応技が見つからず除外）: 20 件
- 自動検出 5 件:
  - OoS乖離 donkey_kong up_b(Up B (Spinning Kong)): 計算19f vs UFD7f
  - OoS乖離 hero up_b(Up B (Woosh/Swoosh/Kaswoosh)): 計算4f vs UFD7f
  - OoS乖離 steve aerial(Sword Forward Air (Short Hop Macro FAir)): 計算7f vs UFD11f
  - OoS乖離 kazuya aerial(Up Air): 計算7f vs UFD11f
  - OoS乖離 kazuya aerial(Neutral Air): 計算11f vs UFD15f

## 注記

- ヒットボックス画像はURLのみ保存（ダウンロードせず）。Storageミラーは後工程。
- needs_review / ai_generated 行は data/imported/name-mapping.csv で確認可能。
- OoS extra_frames は docs/02 定義の固定値（aerial=3/up_b=0/up_smash=0/grab=4/shield_drop=11）。
  実効発生 = moves.startup + extra_frames。UFD実効値との±2F超の乖離は上記に列挙。
