# smash-lab

スマブラSP上達のための個人用ナレッジ&分析システム。使用キャラ: ゼロスーツサムス。

- **閲覧系**（ホスト型Web）: キャラ対メモ / 全キャラフレームデータ / 確定反撃判定 / 検索 — スマホからも見る
- **AI処理系**（Macローカル）: 試合録画の自動レビュー（Gemini） / ZSS特化の情報収集

## ドキュメント

- [要件定義](docs/01_requirements.md)
- [アーキテクチャ設計](docs/02_architecture.md)
- [実装計画](docs/03_implementation-plan.md)
- [リサーチ結果（既存ツール/学習科学/AI精度）](docs/04_research-findings.md)
- [ADR](docs/adr/)

## 構成

React + Vite + Supabase + GitHub Pages（閲覧系） / TypeScriptパイプライン + Gemini API + launchd（AI処理系）。
詳細は [docs/02_architecture.md](docs/02_architecture.md)。
