# 追加機能設計: 練習ループ（意識ポイント・セッション・ティルト検知）

2026-07-06。設計判断は [ADR-0018](adr/0018-practice-loop.md)、エビデンスは [docs/05](05_practice-science.md) を正とする。

## 目的

上達ループ「①目的→②練習/対戦→③記録→④振り返り→⑤反映」のうち、未実装だった①④⑤を閉じる。docs/05 の最重要知見（自己調整サイクル d=1.53 / プロセス目標 d=1.36 / 教示的セルフトーク d=0.55 / ティルト対策は距離置きのみ）の直接実装。

## UI（トップ「今日の練習」カード: components/practice/PracticeCard.tsx）

モードセレクタの下・戦績サマリの上に常設。

- **意識ポイント行**: activeなポイントをチップ表示（技術=中立色/メンタル=黄）。編集パネルで自由入力+プリセット（lib/focusPresets.ts、出典記事リンク付き）から追加、ON/OFF、削除。**アクティブは3個まで**（超過は拒否+理由表示）。
- **セッション行**:
  - 未開始: プロセス目標入力→開始。結果目標語（VIP/到達/勝つ…）検知で言い換えナッジ（lib/practiceLoop.ts の detectResultGoal）
  - 進行中: 目標・このセッションのW-L（時間窓で自動算出、勝敗記録に追従）・「終了して振り返り」
  - 振り返り: ①意識ポイントの実行度（自由記述）②自分を過度に責めていないか（2択+任意メモ）→ composeRetroMd で retro_md に保存
  - 前回セッションが振り返り未記入なら回収導線（「書く」）
- **ティルトバナー**: detectTilt（45分窓・現在3連敗）で表示。「一旦離れて別のことを」+ 対戦メンタル記事リンク。閉じるで抑止（state）。

## データ

- テーブル: sessions(goal, started_at[DB now()], ended_at, retro_md, user_id) / focus_points(body, category, active, user_id)。RLS・時計統一・active一意性は ADR-0018 参照。
- プロバイダ: data/session/・data/focus/（Supabase/Local、switchable.ts の共通ファクトリで委譲。ゲスト切替とリセットは data/guestSwitch.ts に一元化）。
- 純関数: lib/practiceLoop.ts（detectResultGoal / sessionResults / detectTilt / composeRetroMd。時間比較はepoch）。

## 付随機能

- **負け→学習の接続**: 負け記録直後の「メモ→」（undo窓9秒）/ 一覧の「負け越し×対策メモなし」注意ドット（notesの有無はグループ代表idに正規化して判定）
- **確反タブ**: オンライン遅延（+4〜6F）の注記1行（PunishAssumptionsNote）

## テスト

practiceLoop.test.ts（結果目標検知・時間窓境界・ティルト窓/リセット・retro合成）、LocalFocusProvider.test.ts、LocalSessionProvider.test.ts（active一意・後書きretroがended_atを上書きしない）。
