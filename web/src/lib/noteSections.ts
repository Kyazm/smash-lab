// キャラ対メモのセクションテンプレート定義（docs/01 F4 / docs/02 notes.section）。
// 表示順と日本語ラベルを一元管理。UI はこの順でセクション見出しを並べ、流し読みできるようにする。
import type { NoteSection } from "../data/notes/types";

export interface SectionDef {
  key: NoteSection;
  label: string;
  /** 補足（プレースホルダ等） */
  hint: string;
}

// tldr はピン留め(TL;DR)専用のため、通常のセクション分類リストからは除外し、冒頭固定表示で扱う。
export const MATCHUP_SECTIONS: SectionDef[] = [
  { key: "neutral", label: "ニュートラル", hint: "差し合い・立ち回りの基本方針" },
  { key: "disadvantage", label: "不利状況", hint: "崖・着地・被弾後の逃げ方" },
  { key: "edgeguard", label: "復帰阻止", hint: "相手の復帰への対応" },
  { key: "projectile", label: "飛び道具対策", hint: "飛び道具のさばき方" },
  { key: "stage", label: "ステージ選択", hint: "有利/不利ステージ・拒否" },
];

export const ALL_SECTIONS: SectionDef[] = [
  ...MATCHUP_SECTIONS,
  { key: "tldr", label: "TL;DR", hint: "要点（冒頭固定表示）" },
];

const LABEL_BY_KEY: Record<NoteSection, string> = Object.fromEntries(
  ALL_SECTIONS.map((s) => [s.key, s.label]),
) as Record<NoteSection, string>;

export function sectionLabel(section: NoteSection | null): string {
  if (section == null) return "未分類";
  return LABEL_BY_KEY[section] ?? section;
}
