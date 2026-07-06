// localStorage 永続の SessionProvider（ADR-0018）。mock と guest で共用し、キーで分離する。
// 不変条件: 進行中（endedAt=null）は常に最大1件（start時に既存activeを自動クローズ）。
import type { SessionProvider } from "./SessionProvider";
import type { PracticeSession } from "./types";

export const MOCK_SESSION_KEY = "smash-lab.session.v1";
export const GUEST_SESSION_KEY = "smash-lab.guest-session.v1";

interface SessionStore {
  sessions: PracticeSession[];
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class LocalSessionProvider implements SessionProvider {
  private memory: SessionStore | null = null;

  constructor(private readonly storageKey: string) {}

  private hasLocalStorage(): boolean {
    try {
      return typeof localStorage !== "undefined";
    } catch {
      return false;
    }
  }

  private read(): SessionStore {
    if (this.hasLocalStorage()) {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        try {
          return JSON.parse(raw) as SessionStore;
        } catch {
          // 壊れていたら空で再初期化
        }
      }
      return { sessions: [] };
    }
    if (this.memory == null) this.memory = { sessions: [] };
    return this.memory;
  }

  private write(store: SessionStore): void {
    if (this.hasLocalStorage()) {
      localStorage.setItem(this.storageKey, JSON.stringify(store));
    } else {
      this.memory = store;
    }
  }

  async getActive(): Promise<PracticeSession | null> {
    const { sessions } = this.read();
    const actives = sessions.filter((s) => s.endedAt == null);
    if (actives.length === 0) return null;
    return actives.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0];
  }

  async start(goal: string): Promise<PracticeSession> {
    const store = this.read();
    const now = new Date().toISOString();
    // 既存activeを自動クローズ（振り返りはnullのまま残す＝後から書ける）
    store.sessions = store.sessions.map((s) => (s.endedAt == null ? { ...s, endedAt: now } : s));
    const session: PracticeSession = { id: genId(), goal, startedAt: now, endedAt: null, retroMd: null };
    store.sessions.push(session);
    this.write(store);
    return session;
  }

  async finish(id: string, retroMd: string | null): Promise<void> {
    const store = this.read();
    const idx = store.sessions.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error(`session ${id} not found`);
    const s = store.sessions[idx];
    store.sessions[idx] = {
      ...s,
      endedAt: s.endedAt ?? new Date().toISOString(), // 終了済みなら上書きしない（後書きretro）
      retroMd: retroMd ?? s.retroMd,
    };
    this.write(store);
  }

  async listRecent(n: number): Promise<PracticeSession[]> {
    const { sessions } = this.read();
    return [...sessions].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)).slice(0, n);
  }

  /** localStorage/メモリを完全消去（ゲストのリセット用）。 */
  clear(): void {
    if (this.hasLocalStorage()) localStorage.removeItem(this.storageKey);
    this.memory = null;
  }
}
