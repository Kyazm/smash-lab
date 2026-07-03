// フレームバー可視化。1F=1ブロック、発生グレー/持続赤/残り硬直青（Dustloop frameChart方式のCSS実装）。
// docs/06 A-2: 詳細ドロワーで表示。
import type { FrameBarResult } from "../../lib/frameBar";

const SEGMENT_CLASS: Record<FrameBarResult["segments"][number]["kind"], string> = {
  startup: "bg-startup",
  active: "bg-active",
  recovery: "bg-recovery",
};

const SEGMENT_LABEL: Record<FrameBarResult["segments"][number]["kind"], string> = {
  startup: "発生",
  active: "持続",
  recovery: "硬直",
};

interface Props {
  bar: FrameBarResult;
}

export function FrameBarViz({ bar }: Props) {
  return (
    <div>
      <div
        className="flex h-4 w-full overflow-hidden rounded border border-border-subtle"
        role="img"
        aria-label={`フレームバー: 全体${bar.totalFrames}F（${bar.segments
          .map((s) => `${SEGMENT_LABEL[s.kind]}${s.frames}F`)
          .join(" / ")}）`}
      >
        {bar.segments.map((seg, i) => (
          <div
            key={i}
            className={SEGMENT_CLASS[seg.kind]}
            style={{ width: `${(seg.frames / bar.totalFrames) * 100}%` }}
            title={`${SEGMENT_LABEL[seg.kind]} ${seg.frames}F`}
          />
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-muted">
        {bar.segments.map((seg, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-sm ${SEGMENT_CLASS[seg.kind]}`} />
            {SEGMENT_LABEL[seg.kind]} {seg.frames}F
          </span>
        ))}
        <span className="text-ink-muted">全体 {bar.totalFrames}F</span>
      </div>
    </div>
  );
}
