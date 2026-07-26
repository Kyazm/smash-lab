// smash-tube 動画タイトルのパース（純関数・依存なし）。
// 実データの形式: "<Tournament> - [<Round> - ]<PlayerA> (<CharA>) VS <PlayerB> (<CharB>) - <suffix>"
//   例: "Comicpalooza Fight Club 2026 - Pools - Marss (Zero Suit Samus) VS SKZohar (Shulk) - SSBU"
//   Round は省略されることがある。suffix は "SSBU" / "Ultimate Singles" / "Smash Ultimate Singles" 等。
//   相手が "(K. Rool, Kazuya)" のように複数キャラのことがある（→ opp_chars_hint 複数 + needs_review）。
import { splitAndNormalizeChars } from "./char-normalize.js";

export interface Fighter {
  player: string;
  charRaw: string;
}

export interface ParsedTitle {
  ok: boolean;
  tournament: string | null;
  round: string | null;
  suffix: string | null;
  p1: Fighter | null;
  p2: Fighter | null;
  raw: string;
}

// 対戦カード区間: "PlayerA (CharA) VS PlayerB (CharB)"（VS は大小文字問わず）。
const MATCHUP_RE = /^(.+?)\s*\(([^()]+)\)\s+vs\s+(.+?)\s*\(([^()]+)\)\s*$/i;

/** タイトル1本をパースする。対戦カードが取れなければ ok=false。 */
export function parseMatchTitle(title: string): ParsedTitle {
  const raw = title;
  const base: ParsedTitle = {
    ok: false,
    tournament: null,
    round: null,
    suffix: null,
    p1: null,
    p2: null,
    raw,
  };
  if (!title || !title.trim()) return base;

  const segments = title.split(/\s+-\s+/).map((s) => s.trim());
  // 対戦カード区間 = MATCHUP_RE にマッチする最初のセグメント
  let matchupIdx = -1;
  let m: RegExpMatchArray | null = null;
  for (let i = 0; i < segments.length; i++) {
    const mm = segments[i].match(MATCHUP_RE);
    if (mm) {
      matchupIdx = i;
      m = mm;
      break;
    }
  }
  if (matchupIdx === -1 || !m) return base;

  const tournament = matchupIdx > 0 ? segments[0] : null;
  const round = matchupIdx > 1 ? segments.slice(1, matchupIdx).join(" - ") : null;
  const suffix =
    matchupIdx < segments.length - 1 ? segments.slice(matchupIdx + 1).join(" - ") : null;

  return {
    ok: true,
    tournament,
    round,
    suffix,
    p1: { player: m[1].trim(), charRaw: m[2].trim() },
    p2: { player: m[3].trim(), charRaw: m[4].trim() },
    raw,
  };
}

export interface ResolvedMatchup {
  side: "p1" | "p2" | null; // studied プレイヤーがどちらか
  needsReview: boolean;
  studiedCharRaw: string | null; // タイトル上の studied 側キャラ（ヒント。正は CLI --char）
  oppPlayer: string | null;
  oppCharsHint: string[]; // 正規化済み。複数なら needsReview
  multiOppChars: boolean;
}

function samePlayer(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * パース結果と studied プレイヤー名から、studied 側（P1/P2）と相手情報を確定する（純関数）。
 * 側が一意に決まらない（両方一致 or どちらも不一致）場合は side=null + needsReview=true。
 * 相手が複数キャラなら oppCharsHint に全件入れて needsReview=true（ドロップしない）。
 */
export function resolveMatchup(parsed: ParsedTitle, studiedPlayer: string): ResolvedMatchup {
  if (!parsed.ok || !parsed.p1 || !parsed.p2) {
    return {
      side: null,
      needsReview: true,
      studiedCharRaw: null,
      oppPlayer: null,
      oppCharsHint: [],
      multiOppChars: false,
    };
  }
  const p1match = samePlayer(parsed.p1.player, studiedPlayer);
  const p2match = samePlayer(parsed.p2.player, studiedPlayer);

  let side: "p1" | "p2" | null = null;
  if (p1match && !p2match) side = "p1";
  else if (p2match && !p1match) side = "p2";

  if (side === null) {
    // 側判定不能（両方一致 or どちらも不一致）。相手を確定できないので hint は空で残す。
    return {
      side: null,
      needsReview: true,
      studiedCharRaw: null,
      oppPlayer: null,
      oppCharsHint: [],
      multiOppChars: false,
    };
  }

  const studied = side === "p1" ? parsed.p1 : parsed.p2;
  const opp = side === "p1" ? parsed.p2 : parsed.p1;
  const oppCharsHint = splitAndNormalizeChars(opp.charRaw);
  const multiOppChars = oppCharsHint.length > 1;

  return {
    side,
    needsReview: multiOppChars,
    studiedCharRaw: studied.charRaw,
    oppPlayer: opp.player,
    oppCharsHint,
    multiOppChars,
  };
}
