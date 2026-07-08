# ADR-0019: 試合レビューの解析エンジンをClaude Codeセッションに変更

Status: Accepted (2026-07-09) — ADR-0002を全面supersede

## Context
review-matchはGemini課金待ちで停止していた（docs/03）。crv（claude-real-video）v0.5.1でyt-dlp/ffmpegによるフレーム抽出手法が実証済み。Web調査済みの振り返り方法論（death review、One-Mistake Rule。docs/13）により、全編解析よりユーザー指定場面（撃墜シーン等）への集中分析が正しいとわかった。従量課金APIを使わずMaxサブスク内で完結させたいという制約もある。

## Decision
- 解析エンジンをGemini動画ネイティブ解析からClaude Codeセッション自身（Maxサブスク内・追加課金ゼロ）+ ffmpegフレーム抽出に変更。`pipelines/review-match` はprepare/submitの決定論的処理のみを担当し、LLM呼び出しコードは持たない
- 解析単位を動画全編からユーザー指定タイムスタンプ場面（撃墜シーン中心、−25秒〜+5秒の窓）に変更
- `ANTHROPIC_API_KEY` はルートの`.env`に存在するが本機能では意図的に未使用（将来のヘッドレス自動化`claude -p`はv2検討事項とし、その際も`.env`をclaude CLIプロセスに継承させないことをAPI課金化事故防止として明記する）
- ADR-0004（notesへの自動書込禁止。ai_reviewsのみに書く）とADR-0007（YouTube限定公開の取得方式）は維持
- **Supersedes ADR-0002（全面）**。ADR-0002は動画解析エンジン専用の決定で、intel-collectの検索要約やnotes整頓（Gemini利用、ADR-0010管轄）には関与しないため、部分でなく全面supersedeで問題ない

## Consequences
- 癖統計は「レビュー場面の集合」に対する統計になる（全編網羅ではないことを許容）
- 分析はMacでClaude Codeセッションを開いた時にだけ進む非同期UX（自動化ではない）
- エンジンを差し替えてもキュー（matches/ai_reviews）とJSONスキーマ契約は不変
