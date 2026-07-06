// 意識ポイントの供給インターフェイス（ADR-0018）。全てメソッドで定義（switchable.ts のProxy制約）。
import type { FocusCategory, FocusPoint } from "./types";

export interface FocusProvider {
  /** 全件（active優先 → createdAt昇順）。 */
  list(): Promise<FocusPoint[]>;
  add(body: string, category: FocusCategory): Promise<FocusPoint>;
  update(id: string, patch: Partial<Pick<FocusPoint, "body" | "category" | "active">>): Promise<void>;
  remove(id: string): Promise<void>;
}
