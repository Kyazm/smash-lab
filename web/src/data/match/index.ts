// 勝敗記録プロバイダの選択（ADR-0015）。notes/index.ts の Proxy 委譲パターンと完全同型。
//   VITE_NOTES_PROVIDER=supabase または（未指定かつ VITE_DATA_PROVIDER=supabase）→ SupabaseMatchProvider
//   それ以外 → LocalMatchProvider(mockキー)
// ゲストセッション確立時は AuthGate が setActiveMatchProvider(new LocalMatchProvider(GUEST_MATCH_KEY)) で
// 委譲先を差し替える。呼び出し側は常に `matchProvider.method()` の形で参照する（実体委譲）。
import type { MatchProvider } from "./MatchProvider";
import { LocalMatchProvider, MOCK_MATCH_KEY } from "./LocalMatchProvider";
import { SupabaseMatchProvider } from "./SupabaseMatchProvider";

function createMatchProvider(): MatchProvider {
  const kind = import.meta.env.VITE_NOTES_PROVIDER;
  if (kind === "supabase") return new SupabaseMatchProvider();
  if (kind === "mock") return new LocalMatchProvider(MOCK_MATCH_KEY);
  if (import.meta.env.VITE_DATA_PROVIDER === "supabase") return new SupabaseMatchProvider();
  return new LocalMatchProvider(MOCK_MATCH_KEY);
}

/** 起動時に決定する既定プロバイダ（本人ログイン/mock時用）。ゲストからの復帰時にこれへ戻す。 */
export const defaultMatchProvider: MatchProvider = createMatchProvider();

let activeProvider: MatchProvider = defaultMatchProvider;

/** ゲストログイン確立/復帰時に委譲先を差し替える（AuthGate から呼ぶ）。 */
export function setActiveMatchProvider(provider: MatchProvider): void {
  activeProvider = provider;
}

export function getActiveMatchProvider(): MatchProvider {
  return activeProvider;
}

/** 呼び出し側は `matchProvider.listResults(...)` のように使える（Proxyで実体委譲）。 */
export const matchProvider: MatchProvider = new Proxy({} as MatchProvider, {
  get(_target, prop: keyof MatchProvider) {
    const value = activeProvider[prop];
    return typeof value === "function" ? value.bind(activeProvider) : value;
  },
});

export { GUEST_MATCH_KEY, MOCK_MATCH_KEY } from "./LocalMatchProvider";
export type { MatchProvider } from "./MatchProvider";
