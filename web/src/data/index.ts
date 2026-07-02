// プロバイダ選択。既定は FixtureProvider（build/runtime が SupabaseProvider の throw スタブに
// 当たらないようにする）。VITE_DATA_PROVIDER=supabase のときのみ SupabaseProvider を使う。
import type { DataProvider } from "./DataProvider";
import { FixtureProvider } from "./FixtureProvider";
import { SupabaseProvider } from "./SupabaseProvider";

function createDataProvider(): DataProvider {
  const kind = import.meta.env.VITE_DATA_PROVIDER;
  if (kind === "supabase") {
    return new SupabaseProvider();
  }
  return new FixtureProvider();
}

export const dataProvider: DataProvider = createDataProvider();

export type { DataProvider } from "./DataProvider";
