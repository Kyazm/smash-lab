import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages でサブパス配信する場合はビルド時に --base=/<repo>/ を渡す（docs/02: GitHub Pagesホスティング）。
// 既定 base は "/"（開発・プレビュー用）。App 側は import.meta.env.BASE_URL を Router の basename に使う。
//
// PWA (docs/06): GitHub Pages サブパス配信の罠を踏まないための必須設定。
//   - navigateFallback は base 相対の "index.html"。VitePWA が実際の base（--base=/smash-lab/）を自動追従する。
//   - navigateFallbackDenylist で Supabase API・外部オリジンへのナビゲーションは SW フォールバック対象外にする
//     （SPAナビゲーションと誤認して index.html を返さないため）。
//   - SPAフォールバックは SW が主・404.html（deploy-pages.yml でコピー）は SW 未対応環境向けの従、と責務を分離。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Kyazm Smash Lab",
        short_name: "Smash Lab",
        description: "スマブラSP上達用の個人ツール（フレームデータ・確定反撃・キャラ対メモ）",
        theme_color: "#0b0e14",
        background_color: "#0b0e14",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // オフラインで見えるのはフレームデータ・確反のみ（バンドルJSON）。メモ/提案はSupabase必須でオンライン限定。
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /supabase\.co/],
        runtimeCaching: [
          {
            // タブ単位でlazy importされる取込JSON（data/imported/*.json）をオフラインでも参照可能にする
            urlPattern: /\/data\/imported\/.*\.json$/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "smash-lab-framedata" },
          },
        ],
      },
    }),
  ],
  server: {
    // previewツールがPORT環境変数でポートを割り当てる（5173固定だと他セッションと衝突）
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
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
