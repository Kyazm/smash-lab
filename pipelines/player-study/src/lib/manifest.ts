// MANIFEST.json の型・組み立て・出力契約（labels.json の形状と enum）の埋め込み。
// prep が書き、Claude Code セッションがこれを見て zoom→ラベリングし labels.json を書く。docs/14 が正。
import { METHODOLOGY_REF } from "../config.js";
import {
  ACTION_CATEGORIES,
  ACTION_EASY_SLUGS,
  OUTCOMES,
  SIDES,
  SITUATIONS,
} from "./labels-schema.js";
import type { GridCell } from "./grid.js";

export interface ManifestGrid {
  path: string; // MANIFEST からの相対パス（scan/grid_NN.jpg）
  cells: GridCell[]; // 各セル (row,col) ⇔ t_sec
}

export interface Manifest {
  video_id: string;
  title: string;
  duration_sec: number;
  studied_player: string | null;
  studied_char: string | null;
  opp_chars_hint: string[]; // タイトルパースのヒント（相手キャラ。複数なら needs_review）
  needs_review: boolean;
  kill_anchors: number[]; // ストック変化アンカー（撃墜候補秒）
  scan_frame_count: number;
  grids: ManifestGrid[];
  output_contract: unknown;
  workdir: string;
  methodology_ref: string;
}

/**
 * labels.json の期待形状と enum を MANIFEST へ埋め込む（Claude Code がこれを見て labels.json を書く）。
 * labels-schema.ts の検証契約と一致させること。
 */
export function buildOutputContract(): unknown {
  return {
    description:
      "kill_anchors 全件 + grids のセル（各 t_sec）で候補窓を列挙し、優先度順（撃墜→崖→着地→残り）に " +
      "zoom <video_id> --t <sec> で密バーストを出して行動を判定する。結果を workdir/labels.json に保存する。",
    workflow: [
      "各ゲーム開始時に HUD プレイヤータグで side（どちらが studied か）と opp_char をゲーム単位で目視確定する（カウンターピック対応。opp_chars_hint はヒントに過ぎない）。",
      "kill_anchors とグリッドスキャンで候補窓を列挙し、zoom でバーストを出す。",
      "各 interaction に frame（バースト内の代表フレーム相対パス）を1枚指定する。submit がそれを Storage へ上げる。",
      "低confidence(<0.6)と action='unknown' は統計の分母から除外される想定（別バケット表示）。判定不能は無理に埋めない。",
    ],
    shape: {
      video_id: "string（任意。MANIFEST.video_id と一致させる）",
      games: [
        {
          game_index: "number（1始まり整数）",
          opp_char: "string（そのゲームの相手キャラ。submit が別名正規化を通す）",
          side: SIDES.join(" | "),
        },
      ],
      interactions: [
        {
          t_sec: "number（実時刻。バーストの index.json の t_sec を使う）",
          game_index: "number（games[].game_index のいずれか）",
          situation: SITUATIONS.join(" | "),
          sub_situation: "string（任意。崖=正準6分類+2フレ 等）",
          action: `${ACTION_CATEGORIES.join(" | ")} | ${ACTION_EASY_SLUGS.join(" | ")} | unknown`,
          action_detail: "string（任意。向きnote 等。例: nair→bair）",
          outcome: OUTCOMES.join(" | "),
          kill: "boolean（任意。撃墜を取ったか）",
          confidence: "number 0.0〜1.0",
          opp_char: "string（任意。ゲーム値を上書きしたい場合）",
          frame: "string（必須。バースト内フレームの相対パス。例: bursts/t123/frame_015.jpg）",
          note: "string（任意）",
        },
      ],
    },
    enums: {
      situations: SITUATIONS,
      action_categories: ACTION_CATEGORIES,
      action_easy_slugs: ACTION_EASY_SLUGS,
      outcomes: OUTCOMES,
      sides: SIDES,
    },
    docs_ref: METHODOLOGY_REF,
  };
}

export interface BuildManifestInput {
  video_id: string;
  title: string;
  duration_sec: number;
  studied_player: string | null;
  studied_char: string | null;
  opp_chars_hint: string[];
  needs_review: boolean;
  kill_anchors: number[];
  scan_frame_count: number;
  grids: ManifestGrid[];
  workdir: string;
}

export function buildManifest(input: BuildManifestInput): Manifest {
  return {
    video_id: input.video_id,
    title: input.title,
    duration_sec: input.duration_sec,
    studied_player: input.studied_player,
    studied_char: input.studied_char,
    opp_chars_hint: input.opp_chars_hint,
    needs_review: input.needs_review,
    kill_anchors: input.kill_anchors,
    scan_frame_count: input.scan_frame_count,
    grids: input.grids,
    output_contract: buildOutputContract(),
    workdir: input.workdir,
    methodology_ref: METHODOLOGY_REF,
  };
}
