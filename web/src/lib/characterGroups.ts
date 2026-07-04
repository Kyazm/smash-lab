// キャラ選択画面と同じく「1枠に複数ファイターを内包する」グループ定義。
// スマブラSPのポケモントレーナー(ゼニガメ/フシギソウ/リザードン)とホムラ/ヒカリは、
// CSS上は1枠で選択後に交代する。フレームデータは各ファイター個別だが、一覧・戦績・メモは
// 「1キャラ」として扱う（試合中に交代するため対戦相手としては1つ）。
// フレームデータ(characters/moves)は個別ファイターのまま。ここは表示と集約の畳み込みのみを定義する。

export interface GroupMember {
  slug: string;
  /** 詳細ページのサブキャラ切替に出す短いラベル（ファイター名）。 */
  label: string;
}

export interface CharacterGroup {
  key: string;
  /** 一覧・戦績・メモでの表示名。 */
  displayName: string;
  /** 代表ファイター（一覧のアイコン・詳細の初期表示・戦績/メモの集約先）。 */
  representativeSlug: string;
  /** CSS切替順に並べたメンバー。 */
  members: GroupMember[];
}

export const CHARACTER_GROUPS: CharacterGroup[] = [
  {
    key: "pokemon_trainer",
    displayName: "ポケモントレーナー",
    representativeSlug: "pt_squirtle",
    members: [
      { slug: "pt_squirtle", label: "ゼニガメ" },
      { slug: "pt_ivysaur", label: "フシギソウ" },
      { slug: "pt_charizard", label: "リザードン" },
    ],
  },
  {
    key: "aegis",
    displayName: "ホムラ/ヒカリ",
    representativeSlug: "pyra",
    members: [
      { slug: "pyra", label: "ホムラ" },
      { slug: "mythra", label: "ヒカリ" },
    ],
  },
];

const groupByMemberSlug = new Map<string, CharacterGroup>();
for (const g of CHARACTER_GROUPS) {
  for (const m of g.members) groupByMemberSlug.set(m.slug, g);
}

/** slug がグループメンバーならそのグループを返す。 */
export function groupForSlug(slug: string | undefined): CharacterGroup | undefined {
  return slug ? groupByMemberSlug.get(slug) : undefined;
}

/** slug が代表ファイターか（一覧で1枠を出す位置）。 */
export function isRepresentativeSlug(slug: string): boolean {
  const g = groupByMemberSlug.get(slug);
  return g ? g.representativeSlug === slug : false;
}

/**
 * characters（id/slug対応）から、id正規化・表示名解決のヘルパーを作る。
 * 戦績（match_results.character_id）やランキングを「グループ代表id」に畳んで集約するために使う。
 */
export function makeGroupResolver(characters: { id: string; slug: string; name_ja: string }[]) {
  const slugById = new Map(characters.map((c) => [c.id, c.slug]));
  const idBySlug = new Map(characters.map((c) => [c.slug, c.id]));
  const nameById = new Map(characters.map((c) => [c.id, c.name_ja]));

  /** 対戦相手 characterId をグループ代表 id に正規化（メンバーでなければそのまま）。 */
  function normalizeId(id: string): string {
    const slug = slugById.get(id);
    const g = groupForSlug(slug);
    if (!g) return id;
    return idBySlug.get(g.representativeSlug) ?? id;
  }

  /** 正規化後の id に対する表示名（グループなら「ポケモントレーナー」等）。 */
  function displayNameForId(id: string): string {
    const slug = slugById.get(id);
    const g = groupForSlug(slug);
    if (g) return g.displayName;
    return nameById.get(id) ?? "不明";
  }

  return { normalizeId, displayNameForId, idBySlug };
}
