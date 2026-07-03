// フレーム数値の等幅表示（docs/06: 表中の全フレーム数値に tabular-nums + ui-monospace アクセント）。
// AdvBadge を使わない生の数値列（発生/持続/全体/ダメージ等）に使う。
interface Props {
  value: number | string | null | undefined;
  className?: string;
}

export function FrameValue({ value, className = "" }: Props) {
  return <span className={`font-frame text-ink-primary ${className}`}>{value ?? "-"}</span>;
}
