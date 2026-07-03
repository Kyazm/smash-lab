# smash-lab UI/UX刷新設計

2026-07-03。リサーチ: `.context/research-pheasantzelda.md` / `.context/research-smashmate.md` / UFD・Dustloop実地解析 / web-frontend-builderスキル。
解決する不満: ①自キャラメモが縦に長すぎる ②自キャラにフレーム表/確反/キャラ対メモがない（ミラー対策含む） ③キャラ対メモが散文的。

## デザイン方向（デザインコントラクト）

- **画面タイプ**: データ参照ワークスペース（高密度スキャン）。スキャンループ（比較）→詳細ループ（ドロワー）→信頼ループ（出典・前提注記）を設計する
- **審美方向: インダストリアル/テクニカル**。数値が主役のツールとして、等幅数字・機能色・グリッド前面。現状の「ダークスレート+emerald一色」はアンチパターン（単調ダークスレート）なので脱却
- **デザイントークン**（Tailwind theme + CSS変数で一元化。ハードコード禁止）:
  - サーフェス3層: `surface-0/1/2`（ダーク基調は維持、slate単調から中立グレー+色温度差へ）
  - 機能色: `action`（emerald維持）/ `startup` / `active` / `recovery`（フレームバー用、Dustloop方式: 緑/赤/青）
  - **硬直差スケール**: `adv-safe`(>=0 緑) / `adv-minor`(-1〜-4 中立) / `adv-caution`(-5〜-9 amber) / `adv-punish`(<=-10 赤)。フレーム表・確反タブで一貫使用
  - タイポ: UIはシステムフォント維持（PWAオフライン・パフォーマンス優先の意図的選択）。**数値は等幅**（`font-variant-numeric: tabular-nums` + フレーム値に`ui-monospace`アクセント）。Dustloopの「合計値のみ等幅」より一歩進め、表中の全フレーム数値に適用
- **URL状態**: タブ・フィルタは `useSearchParams` に持つ（共有・戻る対応）。一時UIのみローカルstate。パラメータ設計: `?tab=frames|punish|notes|own|moves`、確反タブ内のセグメントは `&mode=defend|attack`
- **PWA化**: vite-plugin-pwaでmanifest+アイコン+アプリシェルと取込済みJSONのオフラインキャッシュ。UFDの知見を踏襲しつつFAT Onlineの反省（初期バンドル9MB）から取込JSONはタブ単位で遅延読込
  - **SW設定の必須事項**（GitHub Pagesサブパス配信の罠）: `base:'/smash-lab/'`、`workbox.navigateFallback:'/smash-lab/index.html'`、`navigateFallbackDenylist` にSupabase API・外部ドメインを指定。SPAフォールバックはSWが主・404.htmlはSW未対応環境の従、と責務を明記
  - **オフラインの線引き**: オフラインで見えるのは**フレームデータ・確反のみ**（バンドルJSON）。メモ/提案はSupabase必須でオンライン限定（read-onlyキャッシュは鮮度表示が必要になるため初期スコープ外）

### タブ⇔データソース⇔遅延チャンク対応

| タブ | データ | 読込 |
|---|---|---|
| frames / moves | 取込JSON（バンドル） | タブ単位でlazy import + Suspense（loading状態必須） |
| punish | 取込JSON | 同上 |
| notes / own | Supabase（要認証・オンライン） | 通常fetch（loading/empty/error状態必須） |

## IA刷新（ADR-0009）

```
/            キャラ一覧（アイコングリッド、自キャラ先頭ピン、検索）
/c/:slug     統一キャラページ。タブ（?tab=）:
               frames | punish | notes        …全キャラ共通
               own    | moves                 …is_mainのみ追加（立ち回り/技メモ）
/me          → /c/zero_suit_samus?tab=own へリダイレクト（廃止）
/search      横断検索（レーン分け維持）
```

- 自キャラも他キャラと同じページ構造になり、フレーム表・確反・**ミラー対策メモ**（既にmatchup/zero_suit_samusとして移行済み）が見られる → 不満②解消
- タブは横スクロール可能なセグメントコントロール。5タブ時もモバイルで破綻しない
- `/me` のリダイレクト先slugはハードコードせず `characters.is_main` から動的解決（使用キャラ変更に耐える）。AuthGateがRouter外側のためログイン中もURLは保持され、認証後に同URLがそのまま解決される

## フレームタブ刷新

- **カテゴリセクション+スティッキーアンカーナビ**（UFD方式）: 地上 / 空中 / 必殺 / つかみ・投げ / 回避 / 基礎ステータス
- 一覧行はコンパクト: 技名 / 発生 / 全体 / **硬直差（advスケール色）** / ダメージ。多値はスラッシュ圧縮を維持
- **行タップ→詳細ドロワー**（ボトムシート）: ヒットボックスGIF（UFDリンク表示）・持続・備考・**フレームバー可視化**（1F=1ブロック、発生グレー/持続赤/残り青、Dustloop `frameChart` 方式のCSS実装）・「この技への確反を見る」→確反タブへ技選択済みでジャンプ
- Dustloopの弱点（14列横スクロール）を回避: 一覧は5列固定、詳細はドロワーに逃がす2段階開示

## 確反タブ

- 守り/攻めのセグメント維持。技選択は**モーダル/ボトムシート選択式**（FATの `ion-select interface="modal"` パターン。長リストのタップ精度問題を回避）+ 検索+カテゴリチップ
- 結果行: 猶予Fを小さな水平バーで可視化 + range_note。前提注記は `<details>` 折りたたみ（常時表示から変更、初回のみ開）
- 補助トグル（FAT準拠）: shield_drop表示（既存）に加え「猶予3F以上のみ」（実戦で安定する反撃だけに絞る）
- 逆引き（攻め）はpheasantzelda/UFDにも無い差別化点（FATのCharacter Punisherと同型）。タブ名は「振っていい技」等の平易な表現に
- 数値の動的色分け（adv-scale）はUFD/SF6版が固定カテゴリ色しか持たない点への明確な差別化

## メモタブ（キャラ対）

- TL;DRピン留めを最上部固定（現行維持）
- **NoteCardはデフォルト折りたたみ**（タイトル+冒頭2行+メタ）。タップで展開。長文ノートは展開時に日付見出しへのチップTOC
- セクションチップ（ニュートラル/不利/復帰阻止/飛び道具/ステージ/未分類）でフィルタ
- **AI整頓バッジ**: 提案がある場合に表示 → 差分ビュー（モバイルはbefore/after切替、デスクトップは並列）→ 承認/却下（後述）
- **外部リンク欄**: 各キャラにpheasantzelda（スマアナ）のMUページとUFDページへのリンクを自動生成。**データの転載はしない**（ライセンス不明・スマメイト由来のため。ADR-0011）
  - URL規則: UFDは `https://ultimateframedata.com/{slug}`（取込元なのでslug完全一致、安全）。スマアナはslug規則が異なるため `web/src/data/externalLinks.ts` にマッピングを持ち、未登録キャラはサイトトップへフォールバック

## 立ち回り/技メモタブ（is_mainのみ）

- 立ち回り: タグチップ「ゼロサム / 基本」（Discord元カテゴリから復元済み）+ 折りたたみカード → 不満①解消
- 技メモ: 技の正規順（弱→強→スマッシュ→空中→B技→投げ）でグループ化、技名チップでジャンプ。タイトルはchannel名でなく技の正式名を表示（move_id結合）

## キャラ対メモのAI整頓（ADR-0010）

散文的なmatchupメモ（`kind='matchup'` の63件。own系35件は元がチャンネル由来で構造が保たれているため対象外）を、事実を保全したままセクション構造に再構成する。**提案・承認制**（ADR-0004の精神。無断書換なし）。

- **migration 0002**:
  - `note_revisions(id, note_id, body_md, replaced_at, reason)` — 承認時に旧本文を保全（reason列で将来のintel採用時の本文差替にも転用可能な汎用設計）
  - `note_proposals(id, note_id, proposed_body_md, change_summary, engine, **base_updated_at**, status(pending|accepted|rejected|stale), created_at)`
  - RPC `apply_note_proposal(proposal_id)`: **冒頭で `notes.updated_at` と `base_updated_at` を照合し、不一致なら `status=stale` にして中断**（楽観ロック。承認前の手動編集を上書きしない）→ 一致時のみ revisions保存→body更新→status更新を1トランザクション
  - **部分承認は作らない**（提案は原子的に採用か却下）。staleになった提案はUIで「元メモが編集されたため再生成が必要」と表示し、再生成ボタンでパイプラインを個別再実行
- **Provider設計**（ADR-0008追補）: 提案系メソッド `listProposals / applyProposal / rejectProposal` は `NotesProvider` インターフェースに追加（別Provider新設はしない）。`MockNotesProvider` には提案seedを同梱し、UI実装（Agent A）がSupabase無しでブラウザ検証できるようにする
- **生成パイプライン** `pipelines/restructure-notes`: 整頓ルール:
  1. 事実の追加・削除・言い換えによる意味変更を禁止（構成の再配置と重複統合のみ）
  2. 出力構成: 冒頭にTL;DR（3〜5行）→ ニュートラル/不利状況/復帰阻止/撃墜・警戒/その他
  3. 日付情報は各項目末尾の出典注記 `(2023-06)` に縮約
  4. 矛盾・古い可能性のある記述は削除せず ⚠ マーク+並記
- 全提案を一括生成→ユーザーがアプリ内の差分ビューで1件ずつ承認/却下。一括承認はしない（自分の考察の変質を防ぐ最後の砦）

## スマメイト連携（ADR-0011で見送り）

公式APIなし・対戦履歴はログイン必須の可能性大・先行ツールが仕様変更で停止した前例あり。自動取込は作らず、プレイヤー別メモに手動でスマメイトIDやURLを書く運用。将来スマメイト側にAPIが出たら再評価。

## 実装計画（Sonnet実装、Fable監査）

| Wave | 内容 | 担当 |
|---|---|---|
| A-1 | デザイントークン導入、**共有コンポーネント先出し（AdvBadge=硬直差色分け・FrameValue=等幅数値。frames/punish両タブで再利用）**、タブURL化、統一キャラページ+リダイレクト、PWA | Agent A（`ui-redesign`ブランチ） |
| A-2 | フレームタブ刷新（セクションナビ/詳細ドロワー/フレームバー/adv色） | Agent A |
| A-3 | メモUX（折りたたみ/チップ/TOC/外部リンク欄）、立ち回り・技メモタブ、確反タブ改善、AI整頓の差分・承認UI（Mock seedで検証） | Agent A |
| B-1 | migration 0002 + apply_note_proposal RPC + restructure-notesパイプライン + matchup 63件の提案生成（本番投入まで） | Agent B（worktree分離、web/src変更禁止） |

検証: vitest全パス・build成功・デスクトップ/モバイル両ビューポートのスクリーンショットQA（Fable）。マージ後にdevelopへ→自動デプロイ。

## 品質ゲート（web-frontend-builderスキル準拠）

- 初回ビューポートにドメインシグナル（フレーム数値・キャラ・技）が具体的に出ていること
- 状態設計: loading / empty（メモ0件）/ error / 長文 / モバイル
- ハードコード色の禁止（トークン経由のみ）
- タップターゲット44px、focus-visible、キーボード操作
- 実データストレステスト: 最長ノート（フォックス対策）、技数最多キャラ、メモ0キャラ
