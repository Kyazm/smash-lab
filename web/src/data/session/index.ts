// 練習セッションプロバイダの選択（ADR-0018）。switchable の共通ファクトリで委譲。
import type { SessionProvider } from "./SessionProvider";
import { LocalSessionProvider, MOCK_SESSION_KEY } from "./LocalSessionProvider";
import { SupabaseSessionProvider } from "./SupabaseSessionProvider";
import { createSwitchable, isSupabaseProviderMode } from "../switchable";

const switchable = createSwitchable<SessionProvider>(() =>
  isSupabaseProviderMode() ? new SupabaseSessionProvider() : new LocalSessionProvider(MOCK_SESSION_KEY),
);

export const defaultSessionProvider: SessionProvider = switchable.defaultProvider;
export const setActiveSessionProvider = switchable.setActive;
export const sessionProvider: SessionProvider = switchable.proxy;

export { GUEST_SESSION_KEY, MOCK_SESSION_KEY } from "./LocalSessionProvider";
export type { SessionProvider } from "./SessionProvider";
