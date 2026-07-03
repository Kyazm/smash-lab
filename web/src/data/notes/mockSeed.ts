// MockNotesProvider の初回シードデータ。ブラウザ検証で主要導線が見えるよう最小限を用意。
// character_id は data/fixtures/characters.json のID（zss/fox/mario）に合わせる。
import type { Note, NoteMedia } from "./types";

const ZSS = "11111111-1111-4111-8111-111111111111";
const MARIO = "22222222-2222-4222-8222-222222222222";
const FOX = "33333333-3333-4333-8333-333333333333";

const now = "2026-07-01T00:00:00.000Z";

function n(partial: Partial<Note> & Pick<Note, "id" | "kind">): Note {
  return {
    id: partial.id,
    kind: partial.kind,
    character_id: partial.character_id ?? null,
    move_id: partial.move_id ?? null,
    player_name: partial.player_name ?? null,
    title: partial.title ?? null,
    body_md: partial.body_md ?? null,
    section: partial.section ?? null,
    starred: partial.starred ?? false,
    pinned: partial.pinned ?? false,
    tags: partial.tags ?? [],
    source: partial.source ?? "manual",
    created_at: partial.created_at ?? now,
    updated_at: partial.updated_at ?? now,
  };
}

export const SEED_NOTES: Note[] = [
  // ── 自キャラ ZSS: 立ち回り ──
  n({
    id: "seed-own-play-1",
    kind: "own_play",
    title: "差し合いの基本",
    body_md:
      "## 置き技\n横強・空前で相手の飛び込みを**置く**。\n\n- ダッシュから急に止まって様子見\n- パラライザーで牽制→ダッシュ掴み",
    tags: ["ニュートラル", "置き技"],
    starred: true,
    updated_at: "2026-07-02T10:00:00.000Z",
  }),
  n({
    id: "seed-own-play-2",
    kind: "own_play",
    title: "復帰ルートの散らし方",
    body_md: "崖外に出されたら上B頼みにせず、空中回避と横Bで軸をずらす。",
    tags: ["復帰"],
    updated_at: "2026-07-01T09:00:00.000Z",
  }),
  // ── 自キャラ ZSS: 技別（move_id は data/fixtures/moves.json の実IDに依存するため未指定=一覧の技別タブでは
  //    move セレクタ選択後に紐づく。ここでは move_id なしの技メモ雛形を1件置く） ──
  n({
    id: "seed-own-move-1",
    kind: "own_move",
    title: "空前の使い所",
    body_md: "先端を当てる意識。着地際に振ると隙が大きいので、上り空前を基本に。",
    tags: ["空前"],
    updated_at: "2026-07-01T08:00:00.000Z",
  }),

  // ── キャラ対 Fox ──
  n({
    id: "seed-mu-fox-tldr",
    kind: "matchup",
    character_id: FOX,
    section: "tldr",
    pinned: true,
    title: "Fox 要点",
    body_md:
      "- 上り逃げに**空後**を置く\n- 復帰は崖端の空前で狩れる\n- 反射があるのでパラライザー多用は禁物",
    starred: true,
    updated_at: "2026-07-02T12:00:00.000Z",
  }),
  n({
    id: "seed-mu-fox-neutral",
    kind: "matchup",
    character_id: FOX,
    section: "neutral",
    title: "ニュートラルの噛み合い",
    body_md: "ダッシュが速いので置き技が刺さりにくい。まず動かず様子見してから差し返す。",
    tags: ["ニュートラル"],
    updated_at: "2026-07-01T11:00:00.000Z",
  }),
  n({
    id: "seed-mu-fox-edgeguard",
    kind: "matchup",
    character_id: FOX,
    section: "edgeguard",
    title: "復帰阻止",
    body_md: "横B復帰は低く来るので崖メテオが刺さる。上B読みなら崖離しジャンプ空後。",
    tags: ["復帰阻止"],
    starred: true,
    updated_at: "2026-07-01T10:30:00.000Z",
  }),
  // ── プレイヤー粒度メモ（Fox の特定プレイヤー） ──
  n({
    id: "seed-player-fox-1",
    kind: "player",
    character_id: FOX,
    player_name: "Light",
    title: "Light の Fox",
    body_md: "崖上がりは回避多め。ジャンプ上がりに空後を置くと当たりやすい。",
    tags: ["崖上がり"],
    updated_at: "2026-07-01T09:30:00.000Z",
  }),

  // ── キャラ対 Mario ──
  n({
    id: "seed-mu-mario-projectile",
    kind: "matchup",
    character_id: MARIO,
    section: "projectile",
    title: "ファイアボール対策",
    body_md: "地上で捌くより低空移動で潜る。ガードするとポンプで崖端に運ばれる。",
    tags: ["飛び道具"],
    updated_at: "2026-07-01T07:00:00.000Z",
  }),
];

export const SEED_MEDIA: NoteMedia[] = [
  {
    id: "seed-media-fox-1",
    note_id: "seed-mu-fox-edgeguard",
    type: "youtube",
    storage_path: null,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    caption: "崖メテオの例",
  },
];

// ZSS の character_id を他モジュールから参照したい場合に備えエクスポート。
export const SEED_MAIN_CHARACTER_ID = ZSS;
