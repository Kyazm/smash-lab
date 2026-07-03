# Personal Smash Lab

スマブラSP上達のための個人用ナレッジ&分析システム。自キャラはアプリ内で選択でき（初期値: ゼロスーツサムス）、切り替えても各キャラのメモは保持される。

公開URL: https://kyazm.github.io/smash-lab/

## できること

- **全キャラのフレームデータ** — 発生 / 全体F / ガード硬直差 / ダメージ / ヒットボックス画像
- **確定反撃判定（双方向）** — 相手の技→自分の確反リスト、自分の技→ガードに安全か。ガーキャン（空中技は技ごと）/ ガード解除反撃 / ジャスガ（ガード解除11F省略）を含む
- **キャラ対メモ** — 相手キャラ / 特定プレイヤー単位。Markdown+画像/動画/ツイート埋め込み。AI整頓（提案・承認制）
- **戦績記録** — VIP/スマメイト/オフライン別に相手キャラごとの勝敗をワンタップ記録、勝率・連勝・キャラ別ランキングをグラフ表示（アカウントごとに分離）
- **自キャラメモ** — 立ち回り / 技別 / 試合、タブ整理
- **横断検索** — キャラ名 / 技名 / メモ本文
- **ライブラリ（公開記事）** — 練習科学・調査ノートを認証不要で閲覧
- **AI試合レビュー**（予定 / Gemini）、**外部情報収集**（予定）

閲覧系はPWA対応（ホーム画面追加でオフラインでもフレームデータ/確反を参照可）。認証は単一オーナー。オーナーのメモ・AI整頓提案は個人のものとしてRLSでオーナー限定（notes/note_media/note_proposals は is_writer()）。戦績記録（match_results）はアカウントごとの行単位RLS（user_id分離）で、is_writer()の対象外。ゲストは公開情報（フレームデータ・確反・ライブラリ記事）を閲覧でき、メモは自分のローカルサンドボックスに追加して機能を試せる（オーナーの実データは見えず・不変）。

## 構成

- **閲覧系**: React + Vite + TypeScript + Tailwind + Supabase、GitHub Pages（develop push で自動デプロイ）
- **AI処理系**: TypeScriptパイプライン + Gemini API（Macローカル、Supabase経由で疎結合）
- フレームデータは Ver.13.0.1 で静的。日本語技名は検証窓スプレッドシート由来
- キャラアイコンは外部参照（自サーバーに再配布しない）

## ドキュメント

- [要件定義](docs/01_requirements.md) / [アーキテクチャ](docs/02_architecture.md) / [実装計画](docs/03_implementation-plan.md)
- [リサーチ結果（既存ツール/学習科学/AI精度）](docs/04_research-findings.md) / [練習科学](docs/05_practice-science.md)
- [UI/UX設計](docs/06_ui-redesign.md) ほか docs/07・08（機能設計）
- [ADR](docs/adr/)（設計判断の履歴。自キャラ選択=ADR-0013、ゲスト=ADR-0014、戦績記録=ADR-0015 など）

## 開発

```
cd web && npm install && npm run dev     # 開発サーバー
npm run typecheck && npm test            # 型チェック + テスト
npm run build -- --base=/smash-lab/      # 本番ビルド
```

CI: `ci.yml`（PR・非developブランチで型/テスト/ビルド）、`deploy-pages.yml`（develop push でデプロイ、docs-only はスキップ）。接続情報・キーは `.env`（git管理外）。
