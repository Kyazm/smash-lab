// デザイントークン（docs/06_ui-redesign.md）。CSS変数(src/index.css :root)をTailwindユーティリティに
// マッピングする。ハードコード色（bg-slate-900等）は新規追加禁止、必ずこのトークン経由で使う。
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
        },
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
        },
        ink: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        action: {
          DEFAULT: "var(--color-action)",
          strong: "var(--color-action-strong)",
        },
        startup: "var(--color-startup)",
        active: "var(--color-active)",
        recovery: "var(--color-recovery)",
        adv: {
          safe: "var(--adv-safe)",
          minor: "var(--adv-minor)",
          caution: "var(--adv-caution)",
          punish: "var(--adv-punish)",
        },
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        info: "var(--color-info)",
      },
      fontFamily: {
        frame: ["ui-monospace", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
