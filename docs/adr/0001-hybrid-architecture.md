# ADR-0001: 閲覧系ホスト型Web + AI処理系ローカルのハイブリッド構成

Status: Accepted (2026-07-03)

## Context
キャラ対メモは対戦中にスマホで見たい（Discord運用が成立していた理由）。一方、AI試合レビューの入力はMacローカルのフル試合録画（容量大）で、クラウドへ常時アップロードするのはコスト・手間に合わない。

## Decision
- 閲覧系（メモ/フレームデータ/確定反撃/検索）: React + Supabase + GitHub Pagesのホスト型Web
- AI処理系（動画レビュー/情報収集）: MacローカルのパイプラインがGemini APIを呼び、結果のみSupabaseへ書き戻す
- 両者はSupabase経由でのみ結合（疎結合）

## Consequences
- スマホ閲覧とローカル動画処理を両立。パイプライン停止時も閲覧系は無傷
- 代償: 実行環境が2系統になり、service roleキーのローカル管理が必要
