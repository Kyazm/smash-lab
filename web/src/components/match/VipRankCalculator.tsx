// 世界戦闘力 → 段位（VIPランク）計算機。クマメイトの正規化方式（ボーダー基準の相対倍率）をローカルで再現。
// ボーダーは手入力（プリセット初期値・端末保存）。値はクマメイトの推定なので出典を明記し自動取得はしない。
import { useEffect, useState } from "react";
import {
  DEFAULT_VIP_BORDER,
  VIP_BORDER_AS_OF,
  rankFromGsp,
} from "../../lib/vipRank";

const GSP_KEY = "smash-lab.vip-gsp.v1";
const BORDER_KEY = "smash-lab.vip-border.v1";

function readNum(key: string, fallback: number | null): number | null {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function VipRankCalculator() {
  const [gsp, setGsp] = useState<string>(() => {
    const v = readNum(GSP_KEY, null);
    return v == null ? "" : String(v);
  });
  const [border, setBorder] = useState<string>(() =>
    String(readNum(BORDER_KEY, DEFAULT_VIP_BORDER)),
  );

  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined") {
        if (gsp.trim() !== "") localStorage.setItem(GSP_KEY, gsp.trim());
        localStorage.setItem(BORDER_KEY, border.trim());
      }
    } catch {
      // 永続失敗は致命的でない
    }
  }, [gsp, border]);

  const result = rankFromGsp(Number(gsp), Number(border));

  return (
    <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
      <p className="mb-3 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        VIPランク計算（世界戦闘力→段位）
      </p>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-secondary">世界戦闘力</span>
          <input
            type="number"
            inputMode="numeric"
            value={gsp}
            onChange={(e) => setGsp(e.target.value)}
            placeholder="例: 14800000"
            className="min-h-11 w-44 rounded-md border border-border bg-surface-0 px-3 text-sm text-ink-primary focus:border-action focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-secondary">VIPボーダー（手入力）</span>
          <input
            type="number"
            inputMode="numeric"
            value={border}
            onChange={(e) => setBorder(e.target.value)}
            className="min-h-11 w-44 rounded-md border border-border bg-surface-0 px-3 text-sm text-ink-primary focus:border-action focus:outline-none"
          />
        </label>
      </div>

      {result ? (
        <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-display text-3xl leading-none tracking-wide text-ink-primary">
            {result.rank.name}
          </span>
          <span className="font-frame text-xs tabular-nums text-ink-muted">
            ボーダーの {result.ratio.toFixed(3)} 倍
            <span className={result.isVip ? "ml-2 text-action" : "ml-2 text-ink-muted"}>
              {result.isVip ? "VIP到達" : "VIP未到達"}
            </span>
          </span>
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">世界戦闘力を入力すると段位が出ます。</p>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-ink-muted">
        段位しきい値 = VIPボーダー × 段位指数（VIP到達=1.0基準）で算出。段位定義は{" "}
        <a
          href="https://kumamate.net/vip/"
          target="_blank"
          rel="noreferrer"
          className="text-action-strong underline decoration-action/40 hover:decoration-action-strong"
        >
          クマメイト
        </a>{" "}
        準拠。ボーダーは推定値で日々変動するため手入力（初期値は {VIP_BORDER_AS_OF} 時点）。最新はリンク先で確認を。
      </p>
    </section>
  );
}
