---
name: smash-player-study
description: >
  プレイヤー研究（player-study）の処理スキル。トッププレイヤーの試合動画をDL→スキャン→場面別行動ラベリング→DB投入まで行う。
  トリガー: 「プレイヤー研究を進めて」「研究セットを処理して」「Marssの試合を分析して」「player-studyのバッチ」「/studyのデータを増やして」。
  自分の試合の振り返りは smash-vod-review（別スキル・別語彙）を使う。
---

# smash-player-study

ラベリング基準の正本は `docs/14_player-study.md`（③④は2026-07-27凍結済み）。設計はADR-0020。
このスキルはW2パイロットで実証したサブエージェント分業ワークフローの手順書。

## 前提

- smash-lab リポジトリで実行。npmは `export PATH="$HOME/.nodebrew/current/bin:$PATH"` 前置必須
- CLI: `cd pipelines/player-study && npm run <collect|prep|zoom|submit|fail>`
- 作業Dir: `<repo>/.context/player-study/<video_id>/`。submit成功で全削除される（ストレージ逐次掃除）
- LLM判定はすべてClaude Codeセッション（メイン+サブエージェント）で行う。API課金なし
- yt-dlpが403を吐いたら `brew upgrade yt-dlp`（SABR対策のextractor-argsはvideo.ts実装済み）

## ワークフロー（1セット）

### 1. 対象選定と prep
- カタログ追加が必要なら `npm run collect -- --player <P> --char <C> --pages N`
- `npm run prep -- <video_id>`（または `--next`）。フルDL→1fpsスキャン→3x3グリッド→MANIFEST.json
- prepはバックグラウンド実行可（数分）。403で失敗したらyt-dlp更新→再実行

### 2. スキャン調査（Opusサブエージェント2体・並列）
グリッドを前半/後半で分担。プロンプト必須要素:
- **「サブエージェント生成禁止（Agentツール使用禁止）」を明記**（ネスト事故防止）
- MANIFEST対応表の取得コマンド（`python3 -c` でgrids範囲のセル⇔t_secを出力）
- 観察対象: ゲーム境界（キャラ選択/GO!/GAME!/リザルト）、side（**HUDタグ名**。配信オーバーレイの名前は前セットの表示が残ることがあるので信用しない）、ゲームごとのopp_char、KO（**ストック差オーバーレイ「X - Y」とGAME!が正**。フラッシュ演出単体はKOではない）、崖掴み窓、場外窓
- 出力: 構造化JSONを**workdirに `scan-a.json` / `scan-b.json` として書かせ**、最終メッセージは10行以内の要約のみ（親のコンテキスト節約）

### 3. ラベリング（ゲーム別Opusサブエージェント・並列）
スキャン結果からゲームごとにKO窓・崖窓・場外窓を割り当てる。プロンプト必須要素:
- 「サブエージェント生成禁止」明記
- `docs/14_player-study.md` の③④⑤⑥を最初にReadさせる（凍結基準）
- zoomは自走させる: KO窓は `--before 5 --span 6`（オーバーレイ秒を--tに）。技判別は撃墜ヒットの0.3〜0.5秒前フレーム主眼。崖掴み検知時は+3〜4秒に後続バースト、上がり択の細分類が要るなら `--fps 20`
- 読みは間引き（3枚おき→決定的瞬間のみ密）。150枚以内/zoom15回以内目安
- ルール: kill_confirm=撃墜確定の最後の読み合い1件のみ / 撃墜狙いedgeguard(相手~100%+)で生存されたらeven / confidenceは正直に（<0.6は統計除外、無理に埋めない）/ 技slugは無理せず粗カテゴリ+action_detail
- 出力: labels.json契約（⑦）に沿った断片を**workdirに `labels-g<N>.json` として書かせ**、最終メッセージは件数+問題点の短い要約のみ

### 4. 結合・監査・submit（メインセッション）
```
python3 pipelines/player-study/scripts/merge-labels.py <video_id>   # labels-g*.json→labels.json + フレーム実在検証
```
- 抜き取り監査: 代表フレームを1〜2枚Readし、%表示・エフェクトがラベル記述と整合するか確認
- `npm run submit -- <video_id>`（検証→Storage upload→INSERT→status done→workdir削除）
- 中断・放棄時は必ず `npm run fail -- <video_id> --message "…"`（processing座礁防止）

## 予算とバッチ運用

- 分業構成ならメインセッション1つで2〜4セット回せる（サブエージェント結果はファイル退避でコンテキスト節約）
- パイプライン化可: セットNのラベリング中にセットN+1のprepを回してよい（DL帯域とCPUは競合しない）
- 統計は蓄積型。中途で止めても submit 済み分は /study ページに反映される
