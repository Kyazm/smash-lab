// デザイントークン（.context/design-satoh.md）。CSS変数(src/index.css :root)をTailwindユーティリティに
// マッピングする。ハードコード色（bg-slate-900等）は新規追加禁止、必ずこのトークン経由で使う。
// 各トークンは rgb(var(--x) / <alpha-value>) 形式。CSS変数側は空白区切りRGBチャンネル値で定義し、
// これにより不透明度修飾子（bg-action/15, border-info/50 等）が正しく効く。
/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: token("--surface-0"),
          1: token("--surface-1"),
          2: token("--surface-2"),
        },
        border: {
          subtle: token("--border-subtle"),
          DEFAULT: token("--border-default"),
        },
        ink: {
          primary: token("--text-primary"),
          secondary: token("--text-secondary"),
          muted: token("--text-muted"),
        },
        action: {
          DEFAULT: token("--color-action"),
          strong: token("--color-action-strong"),
        },
        accent: {
          // 赤アクセント（ブランド SMASH・★自キャラピル等）。CSS変数は action と共通の #e63950 系。
          // action(CTA/操作系) とは別名で「ブランド/強調の赤」を意味的に区別して使う。
          red: token("--color-action"),
          "red-strong": token("--color-action-strong"),
          yellow: token("--accent-yellow"),
        },
        startup: token("--color-startup"),
        active: token("--color-active"),
        recovery: token("--color-recovery"),
        adv: {
          safe: token("--adv-safe"),
          minor: token("--adv-minor"),
          caution: token("--adv-caution"),
          punish: token("--adv-punish"),
        },
        danger: token("--color-danger"),
        warning: token("--color-warning"),
        info: token("--color-info"),
      },
      fontFamily: {
        // 見出し（Anton極太コンデンス。和文はシステム太ゴシックにフォールバック）
        display: ["Anton", '"Hiragino Kaku Gothic StdN"', '"Yu Gothic"', '"Noto Sans JP"', "sans-serif"],
        // 本文（body既定と一致させる）
        sans: [
          '"Inter Variable"',
          "Inter",
          '"Hiragino Kaku Gothic ProN"',
          '"Yu Gothic"',
          '"Noto Sans JP"',
          "system-ui",
          "sans-serif",
        ],
        // フレーム数値（tabular-nums）。未ロード時はシステムmonoにフォールバック
        frame: ['"JetBrains Mono"', "ui-monospace", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
