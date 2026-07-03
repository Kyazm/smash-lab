// 勝敗記録の供給インターフェース。LocalMatchProvider / SupabaseMatchProvider の共通契約（ADR-0015）。
// 全てメソッドで定義する（index.ts の Proxy が typeof value === "function" で bind するため、
// フィールド/getter を持たせると委譲が壊れる。notes/index.ts と同じ制約）。
import type { MatchQuery, MatchResult, MatchMode, MatchOutcome } from "./types";

export interface MatchProvider {
  /** 条件に一致する記録を createdAt 昇順で返す（時系列グラフの起点）。 */
  listResults(query?: MatchQuery): Promise<MatchResult[]>;
  /** 1タップ=1試合を追記する。id/createdAt は実装側で採番。 */
  addResult(input: { characterId: string; mode: MatchMode; result: MatchOutcome }): Promise<MatchResult>;
  /** 誤記録の取消（undo）用。id 一致を削除。 */
  deleteResult(id: string): Promise<void>;
}
