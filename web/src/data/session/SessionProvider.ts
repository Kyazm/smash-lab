// 練習セッションの供給インターフェイス（ADR-0018）。全てメソッドで定義（switchable.ts のProxy制約）。
import type { PracticeSession } from "./types";

export interface SessionProvider {
  /** 進行中（endedAt=null）のセッション。無ければnull。 */
  getActive(): Promise<PracticeSession | null>;
  /**
   * セッション開始。既に進行中があれば自動で閉じてから開始する（多重active防止。
   * 閉じられた側は振り返り未記入のまま残り、後からretroを書ける）。
   */
  start(goal: string): Promise<PracticeSession>;
  /** 終了+振り返り保存。終了済みセッションへの後書きretroにも使う（endedAtは上書きしない）。 */
  finish(id: string, retroMd: string | null): Promise<void>;
  /** 直近n件（startedAt降順）。 */
  listRecent(n: number): Promise<PracticeSession[]>;
}
