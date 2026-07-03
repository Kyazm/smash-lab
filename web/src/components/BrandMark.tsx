// ブランドロゴ小コンポーネント（FU-8 A-1）。「KYAZM SMASH LAB」を全画面で統一表示する。
// font-display(Anton) / uppercase / tracking / SMASH のみ accent-red。sm/md の2サイズ。
// モック(.context/design-mockup.html) の KYAZM <red>SMASH</red> LAB ブランドに準拠。

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
      KYAZM<span className="text-accent-red"> SMASH</span> LAB
    </span>
  );
}
