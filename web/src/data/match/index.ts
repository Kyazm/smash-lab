// 勝敗記録プロバイダの選択（ADR-0015）。Proxy委譲は switchable.ts の共通ファクトリに載せ替え（ADR-0018）。
//   supabaseモード → SupabaseMatchProvider / それ以外 → LocalMatchProvider(mockキー)
// ゲストセッション確立時は guestSwitch.ts が setActiveMatchProvider(new LocalMatchProvider(GUEST_MATCH_KEY)) で
// 委譲先を差し替える。呼び出し側は常に `matchProvider.method()` の形で参照する（実体委譲）。
import type { MatchProvider } from "./MatchProvider";
import { LocalMatchProvider, MOCK_MATCH_KEY } from "./LocalMatchProvider";
import { SupabaseMatchProvider } from "./SupabaseMatchProvider";
import { createSwitchable, isSupabaseProviderMode } from "../switchable";

const switchable = createSwitchable<MatchProvider>(() =>
  isSupabaseProviderMode() ? new SupabaseMatchProvider() : new LocalMatchProvider(MOCK_MATCH_KEY),
);

/** 起動時に決定する既定プロバイダ（本人ログイン/mock時用）。ゲストからの復帰時にこれへ戻す。 */
export const defaultMatchProvider: MatchProvider = switchable.defaultProvider;

/** ゲストログイン確立/復帰時に委譲先を差し替える（guestSwitch.ts から呼ぶ）。 */
export const setActiveMatchProvider = switchable.setActive;

/** 呼び出し側は `matchProvider.listResults(...)` のように使える（Proxyで実体委譲）。 */
export const matchProvider: MatchProvider = switchable.proxy;

export { GUEST_MATCH_KEY, MOCK_MATCH_KEY } from "./LocalMatchProvider";
export type { MatchProvider } from "./MatchProvider";
