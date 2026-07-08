# AI試合レビュー — 振り返り方法論と機能設計

review-matchパイプライン・Web UI・`.claude/skills/smash-vod-review/` が共通で参照する正本。①は振り返りの進め方（方法論）、②は実装契約（データフロー・JSONスキーマ・画面仕様）。方法論を変える時はここを更新し、スキル側は要約チェックリストのみ持つ（重複させない）。

## ① 振り返り方法論（正）

### 原則

1. 全行動に理由を持たせて見直す。「なんとなく」で通した行動を洗い出すのが目的
2. 優先素材は負け試合・格上相手・惜敗。勝ち試合の粗探しは後回し
3. 0.5倍速で2〜3回視聴する。1回目で気になった場面を2回目以降で深掘りする

### 状態遷移フレームワーク

試合は neutral → 有利 → 不利 → 崖攻防 の4状態を行き来する。各状態で次を問う。

| 状態 | 問うこと |
|---|---|
| neutral | 何がきっかけで不利に転落したか / その行動は理由のある選択か手癖か / リスクとリターンは見合っているか |
| 有利 | コンボ・確定反撃の取りこぼしはないか / 着地狩り・崖狩りの継続を自分から切っていないか / なぜ有利を手放したか |
| 不利 | 復帰ルートが一直線で読まれていないか / ジャンプの無駄遣いはないか / 崖を掴まず上から降りて狩られていないか / 微不利からニュートラルへの段階的復帰か、焦って大技を振っていないか / ベクトル変更・ずらしを入れたか |
| 崖攻防 | 攻め側=相手の上がり方の癖を読めたか、ライン管理はできていたか / 守り側=上がり方を散らせたか、同じ択の反復になっていないか |

### death review（撃墜シーンの深掘り。最優先で扱う）

撃墜シーンは3ステップで深掘りする。

1. 何の技で死んだかを特定する
2. 撃墜の1〜3手前まで遡り、起点となった行動を精査する
3. 原因をタグ分類する: 立ち回り被撃墜 / 着地時 / 復帰中 / 崖上がり時 / コンボ完走許容 / 暴発・自滅 / %管理ミス

### ミス分類（実行ミス vs 判断ミス）

- **実行ミス（execution）**: 意図した入力が出せなかった。トレーニングモードの課題として切り分け、振り返りでは深追いしない
- **判断ミス（decision）**: 選択そのものが悪かった。次の4問で深掘りする
  1. なぜその判断をしたか
  2. その時の心理状態はどうだったか
  3. 相手は何を考えていたと思うか
  4. 次はより良い選択肢があったか

### One-Mistake Rule

1回のレビューで直すのは最頻かつ最高インパクトのミス1つに絞る（多くても1〜3個）。改善仮説を1文に収束させ、次のプレイはその1点だけを意識する。findings全件の総花的な指摘は避ける。

## 主要ソース

- Dignitas "A Guide to VOD Analysis"
- Smashboards（VOD分析スレッド各種）
- Aimlabs（実行ミスと判断ミスの切り分け文脈）
- Smashlogスレッド（7866 / 11712 / 6804）
- note記事: thinksmash、はちれつ
- somesh125

## ② 機能設計

`pipelines/review-match`・`web/`・`.claude/skills/smash-vod-review/` はこの節を実装契約として参照する。JSONスキーマ契約は凍結（変更する場合はこのファイルを先に更新してから各実装に反映する）。

### アーキテクチャ（データフロー）

```
iPhone PWA: /review フォーム（URL+タイムスタンプ複数+相手キャラ+勝敗+モード+メモ）
  → RPC create_review_request() が matches + ai_reviews(status='pending') を1トランザクションでINSERT
Mac: smash-lab リポジトリで Claude Code を開きスキル起動「試合レビューを処理して」
  → CLI prepare: pending 1件claim→yt-dlp区間DL→ffmpegフレーム抽出(実時刻保持)→.context/にMANIFEST
  → Claude本人がフレームをReadして方法論チェックリストで分析 → result.json を書く
  → CLI submit: スキーマ検証+集約 → ai_reviews UPDATE(done)   [service role]
  → そのままセッションで対話深掘り可
iPhone PWA: /review 一覧・詳細 → findingsカード + 埋込プレイヤー場面ジャンプ + 承認/棄却
```

先例: `pipelines/restructure-notes` の `--from-file`（`engine='claude-manual'`）が同じ「LLM呼び出しをパイプラインの外に置く」パターンの先例。review-match はこれを prepare/submit の2段CLIに一般化したもの。

### JSONスキーマ契約（凍結）

```
requested_timestamps: [{t_sec, label?}]
findings: [{ id,                     # submit側で採番（"f1","f2"…）。承認/棄却の照合キー
             t_sec, situation(neutral|advantage|disadvantage|ledge|edgeguard|recovery),
             observation, suggestion,
             habit_tag,              # habit_tags語彙（15語）。語彙外はsubmitがnull化+needsReviewフラグ
             mistake_type(execution|decision), confidence,
             review_status('pending'|'accepted'|'rejected'),   # submitが'pending'付与
             death?{stock, kill_move, initiating_action} }]
summary_md: 全場面まとめMarkdown
one_mistake: 改善仮説1文（One-Mistake Rule、独立列）
focus_evaluations: [{focus_point_id, verdict(achieved|partial|not_achieved|not_observable), evidence}]
```

`habit_tag` が検証する固定語彙（15語。既存12語＋本機能で追加した3語）:

| slug | label | 備考 |
|---|---|---|
| ledge_getup | 崖上がり | |
| jump | 飛び | |
| shield | ガード | |
| spacing_move | 置き技 | |
| edgeguard | 復帰阻止 | |
| landing | 着地 | |
| throw_mixup | 投げ択 | |
| op_management | OP管理 | |
| recovery | 復帰 | |
| neutral | ニュートラル | |
| dash_dance | ダッシュ管理 | |
| tech_chase | 受け身狩り | |
| combo_escape | コンボ抜け | ADR-0019で追加。被完走・ずらしミスを含む |
| self_destruct | 暴発・自滅 | ADR-0019で追加 |
| percent_management | %管理 | ADR-0019で追加 |

### 画面仕様

- **`/review`**: フォーム（YouTube URL、タイムスタンプ複数入力 `mm:ss`/`h:mm:ss`許容、相手キャラ、勝敗トグル、モード、メモ）+ 一覧（statusバッジ: pending=Macで処理待ち、processing=1時間超で停滞表示、done、error）
- **`/review/:id`**: findingsカード一覧（situation/habit_tagバッジ、observation/suggestion、mistake_type、死亡時はdeath情報〈stock/kill_move/initiating_action〉）+ summary_md + one_mistake + YouTube IFrame Player APIによる場面ジャンプ（`seekTo()`、外部リンク`watch?v=…&t=Ns`併設）+ finding単位の承認/棄却操作
- オーナー専用。ゲストはページ自体をガードし、provider 5点セット（switchable/guestSwitch対応）は作らない

### コンテキスト予算

1場面あたり最大24枚（640px幅≈307トークン/枚）。1セッションの目安は4場面まで。超える依頼は分割を提案する。

### prepare/submit CLIの役割

- `prepare`: pending 1件をclaimし、動画取得〜フレーム抽出〜MANIFEST.json生成までを行う決定論的処理（LLM呼び出しなし）
- `submit`: Claude Codeが書いたresult.jsonをスキーマ検証・集約する（finding idの採番、t_secの場面窓へのclamp、review_status='pending'付与、habit_tag語彙外のnull化+needsReviewフラグ）。検証後にai_reviewsをUPDATE(done)する

### 冪等性

- claimは既定1件（`--all`でオプトイン）
- 中断・分析放棄時は必ず`fail.ts`でstatus=errorに戻すことをスキル手順で必須化する
- `--retry`（error行の明示再処理）/ `--retry-stale`（processingが1時間超の行の明示再処理）で明示的にのみ再処理する（自動リトライはしない）
