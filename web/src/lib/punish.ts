// 確定反撃エンジン（純粋関数）
// 設計: docs/02_architecture.md「確定反撃判定ロジック」lines 84-111 / ADR-0006（双方向化）に厳密一致。
//
// 計算式（両モード共通）:
//   不利F        = -on_shield          （on_shield は攻撃側から見たガード硬直差。負値=攻撃側不利）
//   実効発生(o)  = o.startup + o.extra_frames
//     extra_frames は oos_options に格納済みの値（ガード状態からその技が出るまでの追加F）
//   確定条件     = 実効発生(o) <= 不利F
//   猶予F        = 不利F - 実効発生(o)
//
// ジャストシールド（isPerfectShield, FU-3）: ガード解除の11Fを省略できるため、
// oosType === 'shield_drop' の候補のみ実効発生から SHIELD_DROP_EXTRA_FRAMES(11) を引く。
// 直接OoS（aerial/up_b/up_smash/grab）は不変。不利F(=-on_shield)も不変。
//
// 入力は DB 行そのものではなく、計算に必要な最小構造体（UI 側で move と oos を結合してから渡す）。
// これにより本モジュールは Supabase 非依存で純粋関数のままテストできる。

/** shield_drop 候補に乗っているガード解除ぶんの追加F。ジャスガ時はこの分を差し引く。 */
const SHIELD_DROP_EXTRA_FRAMES = 11;

/** isPerfectShield 時、shield_drop 候補の実効発生からガード解除ぶん(11F)を差し引く。他タイプは不変。 */
function effectiveStartupFor(candidate: OosCandidate, isPerfectShield: boolean): number {
  const base = candidate.startup + candidate.extraFrames;
  if (isPerfectShield && candidate.oosType === "shield_drop") {
    return base - SHIELD_DROP_EXTRA_FRAMES;
  }
  return base;
}

/** OoS（Out of Shield）反撃候補。move.startup と oos.extra_frames を結合済みの計算用構造体。 */
export interface OosCandidate {
  /** 反撃に使う技の発生F（その技を持つキャラの moves.startup） */
  startup: number;
  /** ガード状態からその技が出るまでの追加F（oos_options.extra_frames） */
  extraFrames: number;
  /** oos_options.oos_type。shield_drop は実用性が低くUIデフォルト非表示 */
  oosType: "aerial" | "up_b" | "up_smash" | "grab" | "shield_drop";
  /** 表示ラベル（例: "空N", "上B"） */
  label?: string | null;
  /** 間合い注記（例: "密着限定", "中距離可"）。フレーム上確定でも間合いで空振りする点の注記 */
  rangeNote?: string | null;
  /** UI で候補を一意に識別するための任意ID（DBの oos_options.id 等） */
  id?: string;
}

/** ガードさせた側の技の最小情報。on_shield のみが計算に効く（startup は表示用）。 */
export interface ShieldedMove {
  /** ガード硬直差。負値=攻撃側不利。>=0 は反撃不可 */
  onShield: number;
  /** 表示用（計算には使わない） */
  startup?: number | null;
  label?: string | null;
  id?: string;
}

/** 確定した1つの反撃行動。 */
export interface PunishHit {
  candidate: OosCandidate;
  /** 実効発生 = startup + extraFrames */
  effectiveStartup: number;
  /** 猶予F = 不利F - 実効発生（>=0） */
  slackFrames: number;
}

/** defensivePunish の結果。 */
export type DefensivePunishResult =
  | { canPunish: false; reason: "safe_on_shield"; disadvantageFrames: 0 }
  | { canPunish: true; disadvantageFrames: number; hits: PunishHit[] };

/**
 * 守りモード: 相手の技 `oppMove` をガードした後、自分（ZSS）の OoS 候補のうち確定するものを返す。
 *
 * 重要: 実効発生に使う startup は「反撃する側（自分）の技」のもの。相手技の startup は使わない。
 * 相手技が寄与するのは on_shield（→不利F）のみ。
 *
 * @param oppMove       ガードさせた相手の技（on_shield が効く）
 * @param myOosOptions  自分（ZSS）の OoS 反撃候補
 * @param isPerfectShield ジャストシールド時は shield_drop 候補の実効発生を11F短縮する（FU-3）
 * @returns on_shield >= 0 なら反撃不可。それ以外は確定行動を実効発生の昇順で返す
 */
export function defensivePunish(
  oppMove: ShieldedMove,
  myOosOptions: OosCandidate[],
  isPerfectShield = false,
): DefensivePunishResult {
  // on_shield >= 0 → 相手有利〜五分。反撃不可
  if (oppMove.onShield >= 0) {
    return { canPunish: false, reason: "safe_on_shield", disadvantageFrames: 0 };
  }

  const disadvantageFrames = -oppMove.onShield;

  const hits = myOosOptions
    .map<PunishHit>((candidate) => {
      const effectiveStartup = effectiveStartupFor(candidate, isPerfectShield);
      return {
        candidate,
        effectiveStartup,
        slackFrames: disadvantageFrames - effectiveStartup,
      };
    })
    // 確定条件: 実効発生 <= 不利F（猶予0F=ちょうど間に合うも確定に含む）
    .filter((hit) => hit.effectiveStartup <= disadvantageFrames)
    // 実効発生の昇順。同値は猶予F降順→安定のため label で決定的に
    .sort(
      (a, b) =>
        a.effectiveStartup - b.effectiveStartup ||
        (a.candidate.label ?? "").localeCompare(b.candidate.label ?? ""),
    );

  return { canPunish: true, disadvantageFrames, hits };
}

/** offensiveSafety の結果。
 *  safe=true は2種類: on_shield>=0 で反撃不可(safe_on_shield)、
 *  または不利Fはあるが実用OoSで確定しない(no_punish)。どちらも「振ってよい」。 */
export type OffensiveSafetyResult =
  | { safe: true; reason: "safe_on_shield" | "no_punish"; disadvantageFrames: number; punishedBy: [] }
  | { safe: false; disadvantageFrames: number; punishedBy: PunishHit[] };

/**
 * 攻めモード: 自分（ZSS）の技 `myMove` をガードさせたとき、相手キャラの OoS 候補で反撃確定するものを列挙。
 * なければ「安全」。守りモードの式を逆向きに適用（ADR-0006）。
 *
 * @param myMove          自分がガードさせた技（on_shield が効く）
 * @param oppOosOptions   相手キャラの OoS 反撃候補
 * @param isPerfectShield ジャストシールド時は shield_drop 候補の実効発生を11F短縮する（FU-3）
 * @returns myMove.on_shield >= 0 → 安全。相手OoSの実効発生 <= 不利F → その行動で反撃確定
 */
export function offensiveSafety(
  myMove: ShieldedMove,
  oppOosOptions: OosCandidate[],
  isPerfectShield = false,
): OffensiveSafetyResult {
  if (myMove.onShield >= 0) {
    return { safe: true, reason: "safe_on_shield", disadvantageFrames: 0, punishedBy: [] };
  }

  const disadvantageFrames = -myMove.onShield;

  const punishedBy = oppOosOptions
    .map<PunishHit>((candidate) => {
      const effectiveStartup = effectiveStartupFor(candidate, isPerfectShield);
      return {
        candidate,
        effectiveStartup,
        slackFrames: disadvantageFrames - effectiveStartup,
      };
    })
    .filter((hit) => hit.effectiveStartup <= disadvantageFrames)
    .sort(
      (a, b) =>
        a.effectiveStartup - b.effectiveStartup ||
        (a.candidate.label ?? "").localeCompare(b.candidate.label ?? ""),
    );

  if (punishedBy.length === 0) {
    // 不利Fはあるが実用OoSで確定しない → 振ってよい
    return { safe: true, reason: "no_punish", disadvantageFrames, punishedBy: [] };
  }
  return { safe: false, disadvantageFrames, punishedBy };
}
