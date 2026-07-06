// localStorage 永続の FocusProvider（ADR-0018）。mock と guest で共用し、キーで分離する。
// LocalMatchProvider と同型（localStorage無し環境=SSR/テストはメモリ退避）。
import type { FocusProvider } from "./FocusProvider";
import type { FocusCategory, FocusPoint } from "./types";

export const MOCK_FOCUS_KEY = "smash-lab.focus.v1";
export const GUEST_FOCUS_KEY = "smash-lab.guest-focus.v1";

interface FocusStore {
  points: FocusPoint[];
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class LocalFocusProvider implements FocusProvider {
  private memory: FocusStore | null = null;

  constructor(private readonly storageKey: string) {}

  private hasLocalStorage(): boolean {
    try {
      return typeof localStorage !== "undefined";
    } catch {
      return false;
    }
  }

  private read(): FocusStore {
    if (this.hasLocalStorage()) {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        try {
          return JSON.parse(raw) as FocusStore;
        } catch {
          // 壊れていたら空で再初期化
        }
      }
      return { points: [] };
    }
    if (this.memory == null) this.memory = { points: [] };
    return this.memory;
  }

  private write(store: FocusStore): void {
    if (this.hasLocalStorage()) {
      localStorage.setItem(this.storageKey, JSON.stringify(store));
    } else {
      this.memory = store;
    }
  }

  async list(): Promise<FocusPoint[]> {
    const { points } = this.read();
    // active優先 → createdAt昇順（安定表示）
    return [...points].sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
    });
  }

  async add(body: string, category: FocusCategory): Promise<FocusPoint> {
    const store = this.read();
    const point: FocusPoint = {
      id: genId(),
      body,
      category,
      active: true,
      createdAt: new Date().toISOString(),
    };
    store.points.push(point);
    this.write(store);
    return point;
  }

  async update(id: string, patch: Partial<Pick<FocusPoint, "body" | "category" | "active">>): Promise<void> {
    const store = this.read();
    const idx = store.points.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`focus_point ${id} not found`);
    store.points[idx] = { ...store.points[idx], ...patch };
    this.write(store);
  }

  async remove(id: string): Promise<void> {
    const store = this.read();
    store.points = store.points.filter((p) => p.id !== id);
    this.write(store);
  }

  /** localStorage/メモリを完全消去（ゲストのリセット用）。 */
  clear(): void {
    if (this.hasLocalStorage()) localStorage.removeItem(this.storageKey);
    this.memory = null;
  }
}
