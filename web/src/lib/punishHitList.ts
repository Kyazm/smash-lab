// PunishHitList（確定反撃の結果一覧UI）が使う純粋ロジック。コンポーネントから分離してテスト可能にする。
// FU-3: 通常ガードの確定行(hits)とジャストシールド時の確定行(perfectShieldHits)をマージし、
// 「ジャスガでのみ確定する行」を判定する。
import type { PunishHit } from "./punish";

/** hit の一意性キー（candidate.id + oosType）。id が無い候補は label で代替する。 */
export function hitKey(hit: PunishHit): string {
  return `${hit.candidate.id ?? hit.candidate.label ?? ""}:${hit.candidate.oosType}`;
}

/** hits に含まれず perfectShieldHits にのみ含まれる行（=ジャスガでのみ確定する行）を返す。 */
export function perfectShieldOnlyHits(hits: PunishHit[], perfectShieldHits: PunishHit[]): PunishHit[] {
  const normalKeys = new Set(hits.map(hitKey));
  return perfectShieldHits.filter((h) => !normalKeys.has(hitKey(h)));
}

export interface DisplayHit {
  hit: PunishHit;
  /** true = 通常ガードでは確定せずジャスガでのみ確定する行 */
  perfectShieldOnly: boolean;
}

/**
 * 表示用にマージ済みリストを構築する。
 * includePerfectShield=false のときはジャスガ限定行を含めない（通常のhitsのみ）。
 * 実効発生の昇順、同値は label 昇順でソートする（punish.ts の並びと揃える）。
 */
export function mergeForDisplay(
  hits: PunishHit[],
  perfectShieldHits: PunishHit[],
  includePerfectShield: boolean,
): DisplayHit[] {
  const onlyHits = includePerfectShield ? perfectShieldOnlyHits(hits, perfectShieldHits) : [];
  const merged: DisplayHit[] = [
    ...hits.map((hit) => ({ hit, perfectShieldOnly: false })),
    ...onlyHits.map((hit) => ({ hit, perfectShieldOnly: true })),
  ];
  return merged.sort(
    (a, b) =>
      a.hit.effectiveStartup - b.hit.effectiveStartup ||
      (a.hit.candidate.label ?? "").localeCompare(b.hit.candidate.label ?? ""),
  );
}
