// 取込パイプライン共通の中間型。最終出力（data/imported/*.json）はスキーマ列に厳密一致させるため
// build-output.ts で変換する。ここでは取得・突合の作業用に情報を多めに保持する。

/** moves.category の許容値（schema CHECK制約と一致） */
export type MoveCategory =
  | "jab"
  | "dash"
  | "tilt"
  | "smash"
  | "aerial"
  | "special"
  | "grab"
  | "throw"
  | "dodge";

/** UFDキャラページから抽出した1技分の生データ */
export interface UfdMove {
  /** UFD movename（例 "Jab 1", "Up B (Super Jump Punch)"） */
  nameEn: string;
  /** UFDのh2セクション由来カテゴリ（groundattacks/aerialattacks/specialattacks/grabs/dodges/misc） */
  section: string;
  /** schema category へマップ済みの値 */
  category: MoveCategory;
  /** 生成する move slug（キャラ内一意） */
  slug: string;
  startup: number | null;
  /** 持続F。"5-7" 等の範囲表記を text で保持 */
  active: string | null;
  /** 全体F = UFD totalframes */
  faf: number | null;
  /** ガード硬直差 = UFD advantage（負値=攻撃側不利） */
  onShield: number | null;
  damage: number | null;
  notes: string | null;
  /** hitbox画像URL（絶対URL化。ダウンロードはしない） */
  hitboxImgUrl: string | null;
  /** UFD上の出現順（英日突合の位置ベースマッチに使う） */
  order: number;
}

/** UFDキャラページのOoS情報（Misc Info の oos1-3 + Shield Grab 等） */
export interface UfdOos {
  /** OoSに使う技のUFD名（例 "Up B", "Neutral Air", "Grab"） */
  moveNameEn: string;
  /** OoS実効発生F（UFD表記の "— N frames" のN。startup+extra込みの実効値） */
  effectiveFrames: number;
  /** schema oos_type へマップ */
  oosType: "aerial" | "up_b" | "up_smash" | "grab" | "shield_drop";
}

/** 1キャラ分のUFD抽出結果 */
export interface UfdCharacter {
  slug: string;
  moves: UfdMove[];
  oos: UfdOos[];
}

/** 検証窓シートから抽出した日本語技名エントリ（セクション+出現順付き） */
export interface JpMove {
  /** 技名（1列目。例 "弱攻撃"）+ 派生名（2列目。例 "弱1"）を結合した表示名 */
  nameJa: string;
  /** 素の技名（1列目のみ） */
  baseName: string;
  /** 派生名（2列目。無ければ空） */
  variant: string;
  /** シートのセクション（"地上攻撃"/"空中攻撃"/"必殺ワザ"/"つかみ・投げ"/"投げ"） */
  section: string;
  /** シート内の出現順 */
  order: number;
}

/** 1キャラ分の日本語技名抽出結果 */
export interface JpCharacter {
  slug: string;
  /** データ取得元: sheet=実データ / derived=元キャラコピー / ai=AI生成フォールバック */
  source: "sheet" | "derived" | "ai";
  moves: JpMove[];
}
