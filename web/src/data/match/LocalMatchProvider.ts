// localStorage 永続の MatchProvider 実装（ADR-0015）。mock と guest で共用し、キーで分離する。
// mock: MOCK_MATCH_KEY / guest: GUEST_MATCH_KEY。guest は空サンドボックスから開始（シードしない）。
// MockNotesProvider の LocalStore と同型（localStorage 無し環境=SSR/テストはメモリ退避）。
import type { MatchProvider } from "./MatchProvider";
import type { MatchQuery, MatchResult, MatchMode, MatchOutcome } from "./types";

/** mock モードの localStorage キー（本人未ログイン開発の既定）。 */
export const MOCK_MATCH_KEY = "smash-lab.match.v1";
/** ゲストサンドボックスの localStorage キー（本人記録とは物理的に別領域）。 */
export const GUEST_MATCH_KEY = "smash-lab.guest-match.v1";

interface MatchStore {
  results: MatchResult[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class LocalMatchProvider implements MatchProvider {
  private memory: MatchStore | null = null;

  constructor(private readonly storageKey: string) {}

  private hasLocalStorage(): boolean {
    try {
      return typeof localStorage !== "undefined";
    } catch {
      return false;
    }
  }

  private read(): MatchStore {
    if (this.hasLocalStorage()) {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        try {
          return JSON.parse(raw) as MatchStore;
        } catch {
          // 壊れていたら空で再初期化
        }
      }
      return { results: [] };
    }
    if (this.memory == null) this.memory = { results: [] };
    return this.memory;
  }

  private write(store: MatchStore): void {
    if (this.hasLocalStorage()) {
      localStorage.setItem(this.storageKey, JSON.stringify(store));
    } else {
      this.memory = store;
    }
  }

  async listResults(query?: MatchQuery): Promise<MatchResult[]> {
    const { results } = this.read();
    const filtered = results.filter((r) => {
      if (query?.characterId !== undefined && r.characterId !== query.characterId) return false;
      if (query?.mode !== undefined && r.mode !== query.mode) return false;
      return true;
    });
    // createdAt 昇順。同一ミリ秒（多重タップ）は挿入順を正とする。
    // Array.sort は安定なので、createdAt のみ比較すれば同時刻は元の push 順（＝実際の記録順）が保持される。
    return filtered.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }

  async addResult(input: { characterId: string; mode: MatchMode; result: MatchOutcome }): Promise<MatchResult> {
    const store = this.read();
    const record: MatchResult = {
      id: genId(),
      characterId: input.characterId,
      mode: input.mode,
      result: input.result,
      createdAt: nowIso(),
    };
    store.results.push(record);
    this.write(store);
    return record;
  }

  async deleteResult(id: string): Promise<void> {
    const store = this.read();
    store.results = store.results.filter((r) => r.id !== id);
    this.write(store);
  }

  /** localStorage/メモリを完全消去する（GuestBanner のリセット用）。 */
  clear(): void {
    if (this.hasLocalStorage()) {
      localStorage.removeItem(this.storageKey);
    }
    this.memory = null;
  }
}
