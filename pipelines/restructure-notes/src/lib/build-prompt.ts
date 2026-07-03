// matchup ノート本文 → Gemini への整頓プロンプト組み立て（純関数）。
// 整頓ルール: ADR-0010 / docs/06_ui-redesign.md「キャラ対メモのAI整頓」

export interface BuildPromptInput {
  characterName: string | null; // 相手キャラ名（notes.character_id 解決後の表示名）
  title: string | null;
  bodyMd: string;
}

const RULES = `あなたはスマブラSPプレイヤーの個人メモを整頓するアシスタントです。
以下のキャラ対メモ（原文）を、事実を一切変えずに読みやすいMarkdown構造へ再構成してください。

# 絶対に守るルール
1. 事実の追加・削除・意味変更を禁止する。やってよいのは「再配置」と「重複している内容の統合」のみ。
   新しい情報を付け足したり、書かれていないことを推測で補ったりしてはいけない。
2. 出力構成は以下の順で固定する（存在するセクションのみ出力してよいが、TL;DRは必須）:
   1. TL;DR（3〜5行の箇条書き。原文の要点を凝縮する。新情報の追加はしない）
   2. ニュートラル
   3. 不利状況
   4. 復帰阻止
   5. 撃墜・警戒
   6. その他
3. 日付情報（「2023年6月に」等）は本文中に残さず、該当項目の末尾に出典注記 \`(YYYY-MM)\` の形で縮約する。
   日付が不明な項目には注記を付けない。
4. 矛盾する記述や古くなっている可能性のある記述は、削除せず ⚠ マークを付けて元の記述のまま並記する
   （例: "⚠ 以前は○○だったが、現在は△△という記述もある"）。判断や統合はユーザーに委ねる。
5. 画像プレースホルダ（\`attachment://...\` 形式）やURLは、元の文脈内の位置関係を保ったまま残す。
   説明している段落や項目の近くに置くこと。
6. 出力はMarkdownのみ。前置きや後書き、コードフェンスでの囲みは不要。本文だけを出力すること。

# 対象キャラ
${"{{CHARACTER}}"}

# 原文（タイトル: {{TITLE}}）
{{BODY}}

上記ルールに厳密に従い、再構成後のMarkdown本文のみを出力してください。`;

export function buildRestructurePrompt(input: BuildPromptInput): string {
  const character = input.characterName?.trim() || "（不明）";
  const title = input.title?.trim() || "（無題）";
  return RULES.replace("{{CHARACTER}}", character)
    .replace("{{TITLE}}", title)
    .replace("{{BODY}}", input.bodyMd);
}

// リトライ時: 欠落トークンを明示して再生成を強制する。
export function buildRetryPrompt(input: BuildPromptInput, missingTokens: string[]): string {
  const base = buildRestructurePrompt(input);
  return `${base}

# 前回の出力で欠落していたトークン（必ず再構成後の本文に含めること。事実の追加ではなく、原文にある情報の保持漏れの修正）
${missingTokens.join(", ")}`;
}
