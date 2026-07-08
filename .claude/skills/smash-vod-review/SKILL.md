---
name: smash-vod-review
description: スマブラSPの試合をVODレビュー（振り返り分析）する。トリガー: 「試合レビューを処理して」「試合を振り返りたい」「VODレビュー」「撃墜された原因を分析」「レビュー依頼を処理」。アプリ(/review)からの依頼処理と、YouTube URL直接指定の対話レビューの両方に対応。
---

# smash-vod-review

## 前提

方法論とJSONスキーマ契約の正は `docs/13_match-review.md`。**作業開始時に必ずRead**する。本文末尾の「フォールバック要約チェックリスト」はdocs/13が読めない時専用の代替であり、通常はdocs/13を参照する。

コマンドは `pipelines/review-match/` で実行する（cwdをそのディレクトリにする）。

## モード判定

- (a) アプリからの依頼処理（pending行の処理を求められた）→ **手順A**
- (b) YouTube URL直接指定の対話レビュー → **手順B**

## 手順A: アプリ依頼処理

使用コマンドは以下で凍結済み（`pipelines/review-match/`、cwdはそのディレクトリ）。

1. `npm run prep` — pending 1件をclaimし `<repo>/.context/review-match/<review_id>/` に `frames/` と `MANIFEST.json` を生成する
   - オプション: `-- --retry`（error行を明示再処理）/ `-- --retry-stale`（1時間超processingの行を明示再処理）
2. `MANIFEST.json` をRead する。video情報・場面窓・フレームパス+t_sec・focus_points・habit_tags語彙・`output_contract`（result.jsonの形状）を把握する
3. 場面ごとにフレーム画像を **t_sec昇順でRead** し分析する（「分析の要点」を適用）。1場面≦24枚・1セッション≦4場面が目安。超える依頼は分割を提案する
4. `result.json` を作業ディレクトリに書く。形状は`MANIFEST.json`の`output_contract`に従う（`scenes[].findings` + `scene_summary` + `summary_md` + `one_mistake` + `focus_evaluations`）。`habit_tag`はMANIFESTの語彙slugのみを使い、確信がなければ`null`にする
5. `npm run submit -- <review_id>` で検証+書込する。エラーが出たらresult.jsonを修正して再実行する
6. 完了したらone_mistake中心にユーザーへ要約を報告し、対話での深掘りを提案する
7. **途中で中断・断念する場合は必ず** `npm run fail -- <review_id> --message "理由"` を実行する（processing座礁防止）

## 手順B: 対話レビュー（URL直接指定）

`npm run dry-run -- --url <URL> --t <秒またはカンマ区切り>` でMANIFESTを生成し、手順A の2〜4と同様に分析する。DBには書かず、そのまま対話で報告する（submit・failは呼ばない）。

## 分析の要点（docs/13の蒸留。各場面で適用）

1. 状態特定: neutral / advantage / disadvantage / ledge / edgeguard / recovery のいずれか
2. 撃墜が絡む場面はdeath reviewを3ステップで実施: ①何の技で死んだかを特定 ②撃墜の1〜3手前まで遡り起点行動を精査 ③原因をタグ分類（立ち回り被撃墜 / 着地時 / 復帰中 / 崖上がり時 / コンボ完走許容 / 暴発・自滅 / %管理ミス）
3. 各指摘に`mistake_type`を付与: `execution`（実行ミス。トレモの課題として切り分け、深追いしない）/ `decision`（判断ミス。次の4問で深掘り: なぜその判断をしたか／その時の心理状態はどうだったか／相手は何を考えていたと思うか／次はより良い選択肢があったか）
4. One-Mistake Rule: 最頻かつ最高インパクトのミス1つ（多くても1〜3個）を`one_mistake`に収束させる。findings全件の総花的な指摘は避ける

## フォールバック要約チェックリスト（docs/13が読めない時のみ使用）

状態別に次を問う:

- **neutral**: 何がきっかけで不利に転落したか / その行動は理由のある選択か手癖か / リスクとリターンは見合っているか
- **有利**: コンボ・確定反撃の取りこぼしはないか / 着地狩り・崖狩りの継続を自分から切っていないか / なぜ有利を手放したか
- **不利**: 復帰ルートが一直線で読まれていないか / ジャンプの無駄遣いはないか / 崖を掴まず上から降りて狩られていないか / 微不利からニュートラルへの段階的復帰か、焦って大技を振っていないか / ベクトル変更・ずらしを入れたか
- **崖攻防**: 攻め側=相手の上がり方の癖を読めたか、ライン管理はできていたか / 守り側=上がり方を散らせたか、同じ択の反復になっていないか

death review（3ステップ）:

1. 何の技で死んだかを特定する
2. 撃墜の1〜3手前まで遡り、起点となった行動を精査する
3. 原因をタグ分類する: 立ち回り被撃墜 / 着地時 / 復帰中 / 崖上がり時 / コンボ完走許容 / 暴発・自滅 / %管理ミス

## 注意

- 分析はこのセッション内で行う。外部API呼び出しは禁止（ANTHROPIC_API_KEYは不使用、ADR-0019）
- フレームは640px幅≈307トークン/枚。コンテキスト予算を意識し、超える依頼は分割を提案する
- ユーザーの自キャラはZSS（ゼロスーツサムス）
