import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages はサブパス配信になりうるため base は相対にしておく（docs/02: GitHub Pagesホスティング）。
// ルーティングは HashRouter を使うため 404.html フォールバックは不要（Phase1骨格）。
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
