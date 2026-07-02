import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// GitHub Pages でサブパス配信する場合はビルド時に --base=/<repo>/ を渡す（docs/02: GitHub Pagesホスティング）。
// 既定 base は "/"（開発・プレビュー用）。App 側は import.meta.env.BASE_URL を Router の basename に使う。
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      // data/fixtures/ の JSON を web/ の外から import するため、リポジトリルートを許可
      allow: [".."],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
