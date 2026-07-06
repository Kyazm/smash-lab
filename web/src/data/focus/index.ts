// 意識ポイントプロバイダの選択（ADR-0018）。switchable の共通ファクトリで委譲。
import type { FocusProvider } from "./FocusProvider";
import { LocalFocusProvider, MOCK_FOCUS_KEY } from "./LocalFocusProvider";
import { SupabaseFocusProvider } from "./SupabaseFocusProvider";
import { createSwitchable, isSupabaseProviderMode } from "../switchable";

const switchable = createSwitchable<FocusProvider>(() =>
  isSupabaseProviderMode() ? new SupabaseFocusProvider() : new LocalFocusProvider(MOCK_FOCUS_KEY),
);

export const defaultFocusProvider: FocusProvider = switchable.defaultProvider;
export const setActiveFocusProvider = switchable.setActive;
export const focusProvider: FocusProvider = switchable.proxy;

export { GUEST_FOCUS_KEY, MOCK_FOCUS_KEY } from "./LocalFocusProvider";
export type { FocusProvider } from "./FocusProvider";
