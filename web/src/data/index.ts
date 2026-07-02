// プロバイダ選択。優先順位:
//   1. VITE_DATA_PROVIDER=supabase → SupabaseProvider（Phase 1 では未実装スタブ）
//   2. data/imported/ に実データがある → ImportedProvider（import-framedata の取込結果）
//   3. それ以外 → FixtureProvider（プレースホルダ、テスト用）
// 既定で throw スタブ（Supabase）に当たらないようにする。
import type { DataProvider } from "./DataProvider";
import { FixtureProvider } from "./FixtureProvider";
import { ImportedProvider, hasImportedData } from "./ImportedProvider";
import { SupabaseProvider } from "./SupabaseProvider";

function createDataProvider(): DataProvider {
  const kind = import.meta.env.VITE_DATA_PROVIDER;
  if (kind === "supabase") {
    return new SupabaseProvider();
  }
  if (kind === "fixture") {
    return new FixtureProvider();
  }
  // 既定: 実データがあれば実データ、無ければフィクスチャ
  if (hasImportedData()) {
    return new ImportedProvider();
  }
  return new FixtureProvider();
}

export const dataProvider: DataProvider = createDataProvider();

export type { DataProvider } from "./DataProvider";
