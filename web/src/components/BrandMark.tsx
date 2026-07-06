// ブランドロゴ小コンポーネント（FU-8 A-1）。「SMASH DB」を全画面で統一表示する。
// font-display(Anton) / uppercase / tracking / DB のみ accent-red。sm/md の2サイズ。

type BrandMarkSize = "sm" | "md";

const SIZE_CLASS: Record<BrandMarkSize, string> = {
  // 一覧見出し上・キャラページ上部などインライン向けの小サイズ
  sm: "text-xl sm:text-2xl",
  // ログイン画面など主役として置く中サイズ
  md: "text-3xl sm:text-4xl",
};

export function BrandMark({
  size = "sm",
  className = "",
}: {
  size?: BrandMarkSize;
  className?: string;
}) {
  return (
    <span
      className={`inline-block font-display uppercase leading-none tracking-wide text-ink-primary ${SIZE_CLASS[size]} ${className}`}
    >
      SMASH<span className="text-accent-red"> DB</span>
    </span>
  );
}
