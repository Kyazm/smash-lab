# smash-lab アーキテクチャ設計

> 自キャラ（メインキャラ）はユーザー選択可（ADR-0013）。本書の「ZSS」は現在の自キャラの例で、機能はメインキャラ非依存。

## 全体構成（ハイブリッド）

```
┌─ 閲覧系（ホスト型） ──────────────────────────────┐
│  React SPA (Vite) ── GitHub Pages                  │
│        │ supabase-js (Auth + RLS)                  │
│  Supabase: Postgres / Auth / Storage(画像)         │
└────────────────────────────────────────────────────┘
                ▲ 書き込み（service role / CLI認証）
┌─ AI処理系（Macローカル） ─────────────────────────┐
│  pipelines/                                        │
│   ├ import-framedata  … UFDスクレイプ→moves投入(一度きり) │
│   ├ import-discord    … Discordエクスポート移行(一度きり)  │
│   ├ review-match      … URL登録→yt-dlp→ffmpeg抽出→Claude Code分析→ai_reviews │
│   └ intel-collect     … 週次/オンデマンド検索→intel_items  │
│  実行: Claude Code(対話/オンデマンド) + launchd(定期/監視) │
└────────────────────────────────────────────────────┘
外部: YouTube(限定公開: フル試合+クリップ) / ultimateframedata.com / 検証窓シート
```

閲覧系とAI処理系はSupabaseを介してのみ結合する（疎結合）。パイプラインが止まってもWebアプリは動く。

## メディア戦略

| 種別 | 置き場所 | 理由 |
|---|---|---|
| メモ埋込の画像 | Supabase Storage | 無料枠1GBで十分 |
| メモ埋込の短尺クリップ | YouTube限定公開（埋込プレイヤー） | 容量無制限・無料。運用: 手動アップ→URLをメモに貼ると自動でnote_media登録（将来YouTube Data APIで自動化可） |
| フル試合録画 | YouTube限定公開（キャプボから自動アップ。これが正） | レビュー時はyt-dlpで区間取得しffmpegでフレーム抽出、Claude Codeが分析。指摘はタイムスタンプリンクで参照（ADR-0007 / ADR-0019） |

## データモデル（Supabase Postgres）

```
characters      id, slug, name_ja, name_en, fighter_number, icon_url, is_main
moves           id, character_id, slug, name_en, name_ja,
                category(jab|dash|tilt|smash|aerial|special|grab|throw|dodge),
                startup, active, faf, on_shield, damage, notes, hitbox_img_url
oos_options     id, move_id(全キャラの技), oos_type(aerial|up_b|up_smash|grab|shield_drop),
                extra_frames, label, range_note   -- 実効発生 = moves.startup + extra_frames
                -- 全キャラ分をUFDのOoS一覧から自動取込(ADR-0006)。ZSS含め自動を正とし、誤りに気づいた時のみ修正
notes           id, kind(own_play|own_move|matchup|player),
                character_id(matchup/player時=相手キャラ, own時=NULL),
                move_id(own_move時), player_name(player時),
                title, body_md, section(neutral|disadvantage|edgeguard|projectile|stage|tldr|NULL),
                starred, pinned(TL;DR用), tags text[],
                source(discord_import|manual|intel_adopted), created_at, updated_at
                -- sectionはキャラ対テンプレートの分類(任意)。pinned=trueはキャラ対ページ冒頭に固定表示
note_media      id, note_id, type(image|youtube|local_video),
                storage_path|url, caption
sessions        id, date, goal, retro_md, user_id, started_at, ended_at
                -- 練習セッション(目的設定→振り返り、ADR-0018)。戦績との紐づけは時間窓
                -- (match_results.created_at ∈ [started_at, ended_at))。activeはユーザーごと最大1(部分ユニーク)
                -- goalはプロセス目標を促す(結果目標の言い換えナッジ)。振り返り必須質問・ティルト休憩提案・
                -- 分散練習の可視化などの組込仕様は docs/05_practice-science.md の表に従う
matches         id, session_id(nullable), user_id, played_at(default now()), opponent_character_id,
                result(win|lose), stocks_diff, video_url(YouTube限定公開), memo,
                mode(vip|smamate|offline), meta_source(auto|manual)
                -- user_id/mode追加、played_atにdefault now()付与(行単位分離、ADR-0019)
                -- meta_sourceは'manual'固定で運用(フォームで相手キャラ・勝敗を直接入力するため。AI推定(auto)は廃止し、癖統計は入力値をそのまま使う)
ai_reviews      id, match_id, user_id, model, status(pending|processing|done|error),
                summary_md, one_mistake,
                requested_timestamps jsonb,  -- [{t_sec, label?}]
                findings jsonb,     -- スキーマは docs/13_match-review.md のJSONスキーマ契約(findings)を正とする
                focus_evaluations jsonb,  -- [{focus_point_id, verdict, evidence}]
                error_message, created_at, updated_at
                -- user_id行単位分離・requested_timestamps/one_mistake/error_message/updated_at追加、
                --   statusにprocessing追加(ADR-0019)
                -- findingsは「候補」。承認/棄却をUIで操作し、癖統計はrejected除外で集計(MLLM精度は人間未満: docs/04 #9)
focus_points    id, body, category(technical|mental), active, created_at, user_id  -- ADR-0018でuser分離
                -- 「意識すること」リスト。アクティブは1〜3個に制限(1スキル集中→実戦転移: docs/04 #10)
                -- mentalカテゴリは技術と同格に扱う(感情制御は第3の専門技能: docs/05 #8)
                -- 達成度はfocus_evaluationsを時系列集計して推移グラフ表示
habit_tags      slug, label        -- 固定タクソノミ(崖上がり|飛び|ガード|置き技|復帰阻止|着地|投げ択|OP管理|コンボ抜け|暴発自滅|%管理…)
intel_items     id, character_id(NULL=汎用), type(article|video), source_url,
                title, summary_md, fetched_at,
                status(inbox|adopted|dismissed), adopted_note_id
intel_requests  id, character_id, query_hint, status(pending|running|done|error),
                requested_at, completed_at   -- オンデマンド深掘りのキュー（Web→ローカルの非同期連携）
match_results   id, user_id, character_id(対戦相手キャラ), mode(vip|smamate|offline),
                result(win|lose), created_at
                -- 1タップ即記録の軽量勝敗ログ(ADR-0015)。追記専用で勝率/連勝/時系列/モード別/キャラ別を純関数導出。
                -- 既存matchesとは責務が別(あちらはセッション/動画由来の詳細ログ)。RLSは行単位user_id分離(下記)
```

- RLS/**Auth+RLSが唯一の防御線**（anonキーは公開前提）。防御モデルは2系統に分かれる:
  - **単一オーナー系**（notes/note_media/note_proposals ほか自分の考察）: `is_writer()`（オーナーuid固定）で書込を限定。notes系はSELECTもオーナー限定（ゲストに実データを見せない、ADR-0014 / migration 0006・0007）。characters/moves/oos_options 等の静的リファレンスはSELECTを全authenticatedに開放（ゲストもフレームデータは読める）
  - **行単位アカウント分離**（match_results=ADR-0015 / sessions・focus_points=ADR-0018 / matches・ai_reviews=ADR-0019）: `user_id = auth.uid()` で各実アカウントが自分の行だけを read/write。共有ゲストは `is_guest()` でDBレベルの書込排除（サンドボックスはローカル完結）。将来のサインアップ開放にそのまま対応
  - サインアップは無効化中。owner列は持たず、上記述語（is_writer/is_guest/auth.uid）で制御する
- intel→notesの昇格はDB関数 `adopt_intel(intel_id, mode, target_note_id)`（SECURITY DEFINER、転記とstatus更新を1トランザクションで実行）経由のみ。これが分離原則のDB側の入口を一本化する
- パイプラインはservice roleキー（Macローカルの`.env`にのみ保管）で書込。service roleはRLSをバイパスするため、パイプラインコードは `notes` への書込を実装しない（ADR-0004。コードレビュー時のチェック項目）
- 検索: `notes.body_md`/`title`/`tags`、`moves.name_ja/name_en`、`characters.name_*`、`intel_items.title/summary_md` に対する ILIKE + pg_trgm。検索結果でnotesとintelはレーンを分けて表示（混在させない）。キャラpage内はクライアントフィルタで十分

### 自分メモと外部情報の分離（設計原則）

`notes`（自分の考察）と `intel_items`（外部収集）はテーブルから分離。UI上も同一キャラページ内の別タブとする。
`intel_items.status=inbox → adopted` の昇格操作で初めて `notes` に転記され、`source=intel_adopted` と出典URLが残る。自動でnotesに書き込むパイプラインは作らない。

## 確定反撃判定ロジック

入力: 相手キャラの技 `m`（`m.on_shield` はガードさせた側の有利F。負値=攻撃側不利）

```
if m.on_shield >= 0 → 「反撃不可（相手有利〜五分）」と表示して終了
不利F = -m.on_shield
実効発生(o) = o.move.startup + o.extra_frames
  extra_frames = ガード状態からその技が出るまでの追加F:
    aerial:      +3  (ジャンプ踏切3F。ガード中ジャンプは解除不要)
    up_b/up_smash: +0 (ガードキャンセル可。技の発生Fがそのまま実効値)
    grab:        +4  (攻撃をガードした直後=シールドスタン中の掴みに付く補正)
    shield_drop: +11 (ガード解除してから出す技)
確定条件: 実効発生(o) ≤ 不利F
猶予F = 不利F − 実効発生(o)
```

出力: 確定する行動を実効発生の昇順で、猶予Fと `range_note`（密着限定/中距離可 等）付きで表示。
表現は「確定」と断定せず**「フレーム上確定（リーチ・位置要確認）」**とする。shield_drop系（ガード解除反撃）はデフォルト表示（ユーザー要望、docs/08 G-1。トグルで隠せる）。

**逆引き（攻めモード、ADR-0006）**: ZSSの技 `z` を選ぶと、相手キャラの `oos_options` に対して同じ式を逆向きに適用し、
「z.on_shield ≥ 0 → 安全」「相手のOoS実効発生 ≤ -z.on_shield → その行動で反撃確定」を表示。
キャラ対ページに「この技は振っていいか」ビューとして組み込む。

注記としてUIに常時表示する前提条件:
- `on_shield` は最終持続Fを密着ガードした場合の代表値。先端当て・持続当て・ワンパターン相殺で数F変動する
- ジャストシールド時は別計算（硬直差が改善）のため対象外
- extra_frames と OoS候補リスト（どの技がOoSとして実用か）は実装時に手動キュレーションし、数値は取込データと突き合わせて検証する

## AI試合レビューパイプライン（review-match、ADR-0019）

詳細（JSONスキーマ契約・画面仕様・冪等性・コンテキスト予算）は [docs/13_match-review.md](13_match-review.md) を参照。ここは概要のみ。

1. **検知**: PWAの `/review` フォーム（URL+タイムスタンプ複数+相手キャラ+勝敗+モード+メモ）→ RPC `create_review_request()` が `matches` + `ai_reviews(status='pending')` を1トランザクションでINSERT
2. **準備（prepare）**: Macでリポジトリを開きスキル起動 → pending 1件claim → yt-dlpで場面窓（−25秒〜+5秒）だけ区間DL → ffmpegでフレーム抽出（実時刻保持）→ `.context/` にMANIFEST.json
3. **解析**: Claude Codeセッション自身がフレームをReadし、方法論（docs/13）に沿って分析する。API呼び出しではなくMaxサブスク内のセッションが行うため追加課金ゼロ
4. **提出（submit）**: result.jsonをスキーマ検証+集約 → `ai_reviews` UPDATE(done)
5. **閲覧**: PWAでfindingsカード表示、`t_sec` で埋込プレイヤーが該当場面へシーク、承認/棄却操作
6. **深掘り**: 同一Claude Codeセッションでそのまま対話継続可能

冪等性（claim/fail/`--retry`/`--retry-stale`）・コンテキスト予算（1場面≦24枚、1セッション≦4場面）・JSONスキーマ契約の詳細は docs/13_match-review.md を参照。

## 外部情報収集パイプライン（intel-collect）

- **定期便**: 週次launchd → Web検索（ZSS 対策/コンボ/大会結果 等のクエリセット）→ 既存 `intel_items.source_url` と重複排除 → 要約付きでinbox投入
- **オンデマンド**: Webアプリのキャラ対ページに「深掘り」ボタン → `intel_requests` にキュー投入 → ローカルでClaude Codeが検知（または手動起動）してdeep research → 対象キャラの `intel_items` に投入。**即時応答ではなく非同期**（ローカル機の稼働に依存。UIは「リクエスト受付済み」表示）
- 収集は inbox 止まり。notes への昇格はユーザー操作のみ（前述の分離原則）
- **参考VOD**: `intel_items(type=video)` のうちトッププレイヤーの試合動画は、キャラ対ページの「参考VOD」欄にマッチアップ別で表示。自分の試合レビューと並べて差分比較する（プロの実践知見: docs/04 #11）
- **採用は2モード**（`adopt_intel(intel_id, mode, target_note_id)`）:
  - `new_note`: 新規ノートとして転記（source=intel_adopted+出典URL）
  - `append_proposal`: **既存メモへの追記案**。AIが対象ノートと追記文面を提案し、差分プレビューをユーザーが承認した時のみ反映（出典URL付き追記）。承認なしで既存メモが書き換わることはない

## Discord移行（import-discord、一度きり）

1. DiscordChatExporterで全チャンネルをJSON+添付ファイルでエクスポート
2. チャンネル名→マッピング表（`7_フォックス対策⭐` → matchup/fox/starred、`ゼロサム技/横b` → own_move/side_b 等）。マッピング表は `.context/` に生成し人間が確認してから実行
3. 同一チャンネル内の連続メッセージは1ノートに統合（日付見出し付き）。編集済みフラグは無視し最終版を採用
4. 添付画像→Supabase Storage、添付動画→ローカル保管ディレクトリへ回収しnote_mediaに登録（YouTube化は必要時に手動）
5. ⭐付きチャンネル → `starred=true`

## 技術スタック

| レイヤ | 選定 | 補足 |
|---|---|---|
| フロント | React + Vite + TypeScript | react-supabase-appスキルの慣例に従う |
| UI | Tailwind CSS | レスポンシブ必須（スマホ閲覧） |
| BaaS | Supabase (Postgres/Auth/Storage) | 無料枠 |
| ホスティング | GitHub Pages | 無料。SPAルーティングは404.htmlフォールバック |
| パイプライン | TypeScript (tsx実行) + ffmpeg | Claude Code/launchdから共通利用 |
| AI | Gemini API（動画・検索要約）, Claude Code（オーケストレーション・対話深掘り） | |

## セキュリティ

- service roleキーはMacローカルの `.env`（git管理外）のみ。フロントにはanonキー+RLS
- anonキーは公開サイトに露出する前提。防御線はRLS+Authのみと認識し、強パスワード+メールOTP（またはMFA）を有効化。漏洩・不正兆候時はキーローテーション
- YouTube限定公開はURL到達者に見える点を許容（個人のゲームクリップのため）
- Supabase Authはメール+パスワード1アカウント。サインアップは無効化
- リポジトリ公開範囲: コードのみコミット（データ・キー・録画は一切含めない）。不安ならプライベートリポ+Actions経由Pagesに切替可
