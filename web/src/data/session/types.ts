// 練習セッション（sessions）の型定義（ADR-0018 / docs/05 #5: 自己調整サイクル d=1.53）。
// 「目的設定 → 対戦 → 振り返り」の1回分。戦績との紐づけはFKでなく時間窓
// （match_results.created_at ∈ [startedAt, endedAt)）。
export interface PracticeSession {
  id: string;
  /** プロセス目標（結果目標っぽい入力はUIで言い換えナッジ）。 */
  goal: string;
  startedAt: string;
  /** null = 進行中。 */
  endedAt: string | null;
  /** 振り返り（構造化質問をMarkdown合成）。null = 未記入。 */
  retroMd: string | null;
}
