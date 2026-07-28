# ADR-0020: プレイヤー研究（player-study）のハイブリッド構成とデータ方針

Status: Accepted (2026-07-25)

## Context
トッププレイヤー（初期対象: Marss/ZSS）の試合動画から「場面ごとに何を選んでいるか」をスクショ根拠付き・多角的に集計したい（docs/04の参考VOD知見の発展）。Ultimateには行動認識の既製モデルも教師データもない。リプレイファイルは非公開でカメラ位置も固定でないため、キャラ位置検出を含む完全自動化は成立しない。自動化できるのは固定HUD（%/タイマー/ストック）の検出のみで、これは業界（Slippi等）でも共通の知見。ADR-0019で確立した「LLM呼び出しをMaxサブスク内のClaude Codeセッションに置き、パイプラインコードは決定論的処理のみ担う」パターンをここでも踏襲する。

## Decision
- **ハイブリッド構成を採用する**。機械側（`pipelines/player-study`）が収集（collect）・フレーム化（prep/zoom）・統計計算（Wilson 95%CI）を担当し、行動の意味付け（situation/action判定）はClaude Codeセッションが行う。ADR-0019と同様、判定側もAPI課金ゼロ（Maxサブスク内のセッション）
- **解析単位は動画1本ずつ**: DL→分析→`submit`成功時に動画本体と全中間フレームを削除し、代表フレーム1枚/interactionのみをStorageに残す（ユーザー要件、ストレージの逐次掃除を反復する運用）。`fail`時は作業Dirを残し、`--retry`成功時に掃除する。review-matchのprepare/submit二段CLIパターンを踏襲するが、動画全体を一時的にDLする点が異なる（review-matchは場面窓のみDLするため元々軽量。本機能は窓の位置が事前にわからないためフルDLが必要）
- **RLSは`is_writer()`系を選ぶ**。単一オーナーの研究データでper-user分離が不要なため。ADR-0010（note_proposals）や0015/0018のuser_id系はper-userアカウント分離+ゲストサンドボックス要件のための設計であり、本件（自分一人の研究用ラベルデータ）には該当しない
- **Storageはnote-mediaバケットの`study/`プレフィックスを流用する**。バケット自体は既にpublic-read（ADR-0012）。ゲーム画面の代表スクショはADR-0012が受容した機密性クラス（URL到達者に見える・パスは推測困難）と同じであり、新規の公開判断は不要
- **smash-tubeへのアクセスは低頻度+HTMLキャッシュ（`.context`配下）で行う**。調査済みの通り利用規約に機械アクセス禁止条項はない。素HTTPは403のためブラウザUA + 1req/2sで対応し、破綻時は手動HTML貼付にフォールバックする
- **ラベル体系（situation/sub_situation/action辞書）はpilot-then-freezeで確定する**。W1では暫定版をdocs/14ドラフトとして記述（冒頭にDRAFT明記）し、W2でMarssの2セット（相手キャラ違い）を実ラベリングして判別可能性・一致率を見た上でdocs/14を凍結する

## Consequences
- ストック変化アンカー（撃墜の機械検出）はW1実測で断念し既定OFF: アイコン極小ROIでも背景のカメラパンで隣接秒差分の中央値が0.70に達し閾値分離が不可能（pipelines/player-study/src/config.ts の実測メモ参照）。撃墜の特定はスキャングリッドのClaude目視で行う（撃墜エフェクト・リスポーン演出は1fpsで確実に写る）
- 統計は「ラベリングしたセットの集合」に対する統計になる（ADR-0019の「レビュー場面の集合」と同じ考え方）。初期は信頼区間が広く、n<10は参考値表示にとどまる
- 動画本体を保持しないため、見返し・再ラベリングには同一video_idの再DLが必要になる（yt-dlpの再取得コストを許容する判断）
- 行動辞書がW2パイロット後に変わりうる。W1はmigration/pipeline実装のみでラベリングはW2から開始するため、辞書変更による既存ラベルの再分類は発生しない設計にしている
- review-matchと同じく、Macで自分がClaude Codeセッションを開いた時にだけ進む非同期UX（自動化ではない）
- **W2パイロット結果（2026-07-27、2セット65 interactions、docs/14 ③④を凍結）**: situation 9種・outcome/kill判定・KO特定（ストック差オーバーレイ+GAME!目視）は10fps/480pで安定。個別技slugはconf>=0.6が全体の約31%にとどまり、空中技（nair/bair/uair）の個別slug昇格は否決、up_smashのみ追加。崖上がり6分類は2セットで2件しか発生せず（トップレベルの崖攻防は復帰技への空中迎撃=edgeguardが主体）、統計主軸はsituation×outcome×killとする。W1の契約バグ（docs/14③の崖行動slugがACTION_VALUES漏れ）をパイロットで発見しACTION_LEDGE_SLUGSとして修正。yt-dlpのSABR 403対策（player_client=default,androidフォールバック）をvideo.tsへ追加
- **W4初期バッチ完了（2026-07-27、10セット・493 interactions投入）**: 相手10キャラ（シュルク/スネーク/G&W/ロックマン/ベヨネッタ/カムイ/ソニック/R.O.B.×2/K.ルール/カズヤ）、Marssセット成績6勝4敗で勝敗両面のデータを確保。分業ワークフロー（スキャン2-3体+ゲーム別ラベラー、結果はworkdirファイル退避）を.claude/skills/smash-player-studyに手順書化。W4で発見・修正: up_smash slugのスキーマ収録漏れ、zoom再実行時の残骸フレーム混入、Web側PostgREST 1000行制限のページング。運用規則の明文化はdocs/14⑥⑩に追記
- **語彙拡張0012（2026-07-27、ユーザーレビュー反映）**: situation第10種`landing_trap`（着地狩り。従来advantageに混在していた攻め側を分離）と、interaction任意フィールド`line`（ライン=位置取りのadv/even/disadv、situationとは独立の軸）を追加。720p試験開始（空中技個別判別が480pで不可能と実測されたため。1セット実測後に本採用判断）
