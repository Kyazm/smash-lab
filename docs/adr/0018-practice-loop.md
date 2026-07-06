# ADR-0018: 練習ループ（セッション・意識ポイント・ティルト検知）

Status: Accepted (2026-07-06)

> 実装設計は [docs/12_practice-loop.md](../12_practice-loop.md)、エビデンスは [docs/05](../05_practice-science.md)（自己調整サイクル d=1.53・プロセス目標 d=1.36）を参照。

## Context
アプリは「知識（フレーム・確反・キャラ対策）」と「記録（戦績）」は揃ったが、上達ループの「目的設定→振り返り→反映」が無かった。docs/05 の組み込み仕様表に設計済み・`sessions`/`focus_points` テーブルも 0001 から存在するが未実装のままだった（両テーブル0行・focus_points に category 列が無い等、docs/02 と実DBの乖離もあった）。

## Decision

### データモデル（migration 0009）
- `sessions` / `focus_points` を match_results(ADR-0015) と同じ**行単位 user_id 分離**へ移行（0行なので破壊なし。従来はSELECT全開放でゲストからオーナーのセッションが見える状態だった）。書込は `not is_guest()` で共有ゲストをDB排除、ゲストはローカルサンドボックス（プロバイダ4系統目・5系統目）。
- `focus_points.category (technical|mental)` を追加（docs/02 記載との乖離解消。メンタルを技術と同格の練習対象に: docs/05 #8）。
- `sessions.started_at / ended_at` を追加。**戦績との紐づけはFKでなく時間窓**（match_results.created_at ∈ [started_at, ended_at)）— 記録側のコード・スキーマは無変更で済む。
- **時計ソースの統一**: started_at はクライアントから送らず DB default now()（match_results.created_at と同じサーバ時計）。端末時計ズレで開始直後の記録が窓から漏れるのを防ぐ。時間比較はISO文字列の辞書順でなく必ずepochで行う（精度・TZ表記の揺れ対策）。
- **activeセッションの一意性はDBレベルで保証**: 部分ユニークインデックス `(user_id) where ended_at is null`。多重タブの同時startは23505で片方が既存activeに収束する。

### 挙動の要点
- start は既存activeを自動クローズする。閉じられた側は**振り返り未記入のまま残り**、UIに「前回が振り返り未記入」の回収導線を出す（振り返り習慣を黙って壊さないためのトレードオフ処理）。
- 振り返りは構造化2問（意識ポイントの実行度・自分を過度に責めていないか: docs/05 #5,#7）を retro_md にMarkdown合成（列追加しない）。
- 意識ポイントのアクティブ上限3は**UI制御**（DB制約にしない。docs/04 #10）。
- ティルト検知は純関数（45分窓で現在3連敗）でクライアント完結。対処提示は「距離置き」のみ（docs/05 #6で唯一有効とされた方略）。
- 結果目標らしい入力（VIP/到達/勝つ等）は正規表現検知で**言い換えナッジ**（ブロックしない）。

### プロバイダ基盤
- Proxy委譲を `data/switchable.ts` の共通ファクトリに集約（3ドメイン目で重複解消。matchも載せ替え、notesはGuestシードの特殊性があるため据え置き）。
- ゲスト⇔本人の切替・ゲストローカル全消去を `data/guestSwitch.ts` に一元化。**切替はsession確定コールバック内で同期実行**という制約（過去のprovider競合バグの再発防止）を維持。

### 付随機能
- 負け記録直後の「メモ→」導線（キャラ対メモへ。undo窓は負け時9秒に延長）と、一覧の「負け越し×対策メモなし」注意ドット — 負けを学習に変換する接続。
- 意識ポイントのプリセット（操作精度ドリル含む、出典記事リンク付き）: `lib/focusPresets.ts`。
- 確反タブにオンライン遅延（+4〜6F）の注記。

## Consequences
- ゲストのローカルサンドボックスは4系統（notes/match/focus/session）になり、リセットは clearGuestLocal に集約。
- セッションの時間窓紐づけは「同時刻に複数モードで遊ぶ」ようなケースを区別しない（許容: セッションはモード横断の概念）。
- focus_points の habit_tags / ai_reviews.focus_evaluations 連携（AIレビューによる意識ポイント達成度評価）は Phase 3（AI試合レビュー）で接続する。レビュー基盤の Gemini→Claude(フレーム抽出) 置換検討は別ADR。
