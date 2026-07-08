# ADR-0002: 動画解析エンジンはGemini API

Status: Accepted (2026-07-03) — ADR-0019に全面supersede（2026-07-09）

## Context
Claude APIはビデオ入力非対応。フレーム抽出して画像列で渡す方式は5分の試合で数十万トークン（数百円/試合）かかり、コマ間の動き情報も失われる。Gemini APIは動画をネイティブ入力でき（約263トークン/秒）、Flash系なら数円〜十数円/試合。

## Decision
動画理解はGemini API、オーケストレーションと対話深掘りはClaude Codeという分担にする。

## Consequences
- 低コストで自動レビューを常用できる
- 精度の期待値はフレーム単位指摘ではなく癖・傾向・状況分類の検出に置く（要件F6に明記）
- Google APIキーの管理が増える
