# プレイヤー研究（player-study）— 行動辞書とラベリング基準

**DRAFT — 行動辞書（③）と判定基準（④）はパイロット2セット（W2、ADR-0020）後に凍結する。それ以外の節（①②⑤⑥）は実装契約として先に固定する。**

`pipelines/player-study`・Web UIの`/study`ページ・`.claude/skills/smash-player-study/`（未実装）が共通で参照する正本。①②は考え方、③④はラベリング基準（凍結対象）、⑤⑥は実装契約。基準を変える時はここを更新してから各実装に反映する。設計の経緯・調査結論はADR-0020および`.context/design-player-study-draft.md`を参照。

## ① 目的と多角集計の考え方

トッププレイヤー（初期対象: Marss/ZSS）の試合動画から「場面ごとに何を選んでいるか（強い行動）」を、スクショ根拠付きで集計する。1試合を丸ごと要約するのではなく、**1判定=1行**（`study_interactions`の1レコード）を積み上げ、後から任意の軸でGROUP BYする設計にする。

- 軸の例: 場面別（situation）、相手キャラ別（opp_char）、プレイヤー別（studied_player。将来Marss以外を追加した時に有効）、大会別（video経由）
- カウントは手段。目的は「この場面ではこの択が有意に多い」を自分の練習に転用すること
- review-match（docs/13）が**自分の試合**を振り返るのに対し、player-studyは**他人の強い試合**から択の分布を学ぶ。対象が違うため語彙・判定基準も意図的に別にする（②参照）

## ② situation語彙とdocs/13との対応

player-studyのsituationは9種。docs/13（review-match）の6種とは**意図的に別語彙**にしている（対象が「自分のミス潰し」と「強者の択の分布」で問う内容が違うため）。

| player-study (docs/14) | docs/13 (review-match) | 差分の理由 |
|---|---|---|
| `neutral` | `neutral` | 同じ |
| `advantage` | `advantage` | 同じ |
| `disadvantage` | `disadvantage` | 同じ |
| `ledge_offense` | `ledge`（攻め側の観点で記述） | docs/13は攻守を`observation`本文で書き分けるが、player-studyは集計軸にするためenumで分離 |
| `ledge_defense` | `ledge`（守り側の観点で記述） | 同上 |
| `landing` | なし（advantage/disadvantageに内包） | 着地狩り・着地回避の択だけを独立集計したいため新設 |
| `edgeguard` | `edgeguard` | 同じ |
| `recovery` | `recovery` | 同じ |
| `kill_confirm` | なし（advantageに内包） | 撃墜起点の行動（confirm技〜撃墜技）を独立集計したいため新設 |

`habit_tags`（docs/13のhabit_tag語彙、15語）とも別語彙。両者を混同しない。

## ③ 崖の語彙（正準6分類+攻め側行動）— DRAFT

一貫規則: **`action`=研究対象プレイヤー自身の選択、`sub_situation`=相手側の択・状況の補足**。崖ではこうなる。

**崖上がりの正準6分類（固定語彙）**

| slug | 内容 |
|---|---|
| `normal_getup` | 通常上がり |
| `jump_getup` | ジャンプ上がり |
| `roll_getup` | 回避上がり |
| `attack_getup` | 攻撃上がり |
| `ledge_drop` | 崖離し行動（崖離し→ジャンプ/回避/攻撃/ステップ等の派生） |
| `ledge_stall` | 崖待機・崖離し崖掴み直し（無敵時間の管理） |

- **`ledge_defense`**（研究対象が崖を掴んでいる側）: `action`に上記6分類のslugを入れる（=本人の上がり択を数える）。`sub_situation`は相手の待ち位置等の補足（任意）
- **`ledge_offense`**(研究対象が崖を攻める側): `action`に攻め側の選択を入れる — 技slug（`down_smash`等）、`ledge_trump`（崖奪い）、`wait_center`（位置取り待機）等。2フレ狙いは技slug+`action_detail`に「2フレ」と書く。`sub_situation`には**相手が選んだ上がり択（上記6分類）**を入れる（=どの択に勝った/負けたかを集計するため）

この語彙はpilotで判別可能性を見て、必要なら統合・追加してdocs/14を凍結する。

## ④ ZSS行動辞書 v1 — DRAFT

`action`は粗カテゴリを必須、個別技slugは視認が容易なものだけ許可する二層構成にする（v1で全技を個別slug化すると判別コストが高く、pilotで一致率を見てから昇格させる方針）。

**粗カテゴリ（必須）**

`aerial` / `ground_attack` / `smash` / `grab` / `special` / `shield_action` / `movement` / `ledge_option`

**視認容易な個別技slug（粗カテゴリの詳細として付与可）**

| slug | 技 | 備考 |
|---|---|---|
| `zair` | 空N（鞭）先端差し込み | 鞭の視覚的特徴が明瞭で判別しやすい |
| `down_smash` | 下スマッシュ | 崖の2フレ択の主力 |
| `boost_kick` | 上B | |
| `flip_jump` | 下B | |
| `plasma_whip` | 横B | |
| `paralyzer` | NB（スタンガン） | |

**空中技の扱い**: `nair`/`bair`等の空中通常技は個別slug化せず、v1では`aerial` + `action_detail`に向き（前/後）をメモする形から開始する。pilotで判別の一致率を確認できたら個別slugへ昇格させる。

**判別不能時**: `action='unknown'` + `confidence`を記録する（④参照、統計からは除外）。

## ⑤ confidenceとunknownの扱い（凍結規則）

- `confidence`は0〜1の主観値。低confidence（**<0.6**）と`action='unknown'`は**統計の分母から除外**し、UI上は別バケット（「判別不能」等）として件数のみ表示する
- 除外基準そのものは凍結対象（`docs/14`のこの節を変える時はADR-0020を更新してから反映する）

## ⑥ ラベリング手順（side / opp_char / outcome）

- **side確定**: 各ゲーム開始時にHUDのプレイヤータグ（P1/P2表示）でどちらがstudied_playerかを判定し、`side('p1'|'p2')`をゲーム単位で記録する
- **opp_char確定**: `opp_char`はゲーム単位でラベリング時に目視確定する（カウンターピック対応。動画タイトルのキャラ名パースは`opp_chars_hint`としてヒント止まりにし、正としない）
- **outcome判定基準**: studied_player視点で、読み合い直後にダメージまたは位置優位を取った側を`won`、取られた側を`lost`、優劣つかずを`even`とする。撃墜に至った場合は`kill=true`を別フラグで立てる（`outcome`とは独立。例: 不利な状況から一発逆転で撃墜しても`outcome='lost', kill=true`はあり得る）

## ⑦ labels.json契約

```
{
  games: [{
    game_index, opp_char, side('p1'|'p2'),
    interactions: [{
      t_sec, situation, sub_situation?, action, action_detail?,
      outcome('won'|'lost'|'even'), kill?, confidence,
      frame,   -- バースト内相対パス（zoomで生成したフレームファイル名）
      note?
    }]
  }]
}
```

`submit`が検証し、代表フレーム1枚/interactionをStorageへアップロードしてから`study_interactions`にINSERTする（`frame_path`はStorageのpublic URLに差し替わる）。

## ⑧ CLI

```
npm run collect                                  # smash-tube検索 → study_videos INSERT(status='cataloged')
npm run prep -- <video_id|--next>                # フルDL → スキャンリール生成（ストックアンカーは実測により既定OFF）
npm run zoom -- <video_id> --t <sec> [--fps 10 --span 4]   # 密バースト生成（既定10fps×4s=40枚）
npm run submit -- <video_id> [--file <path>]     # labels.json検証 → 代表フレームStorage upload → INSERT → 作業Dir削除
npm run fail -- <video_id> --message "…"          # status='error'。作業Dirは残す
```

作業ディレクトリ: `<repo>/.context/player-study/<video_id>/`

```
video.mp4            # prep時にフルDL（480p）
scan/                # 1fpsスキャンリール（3x3グリッドtile）
bursts/               # zoomで生成した密バーストフレーム
MANIFEST.json         # video_id・スキャンリール索引（kill_anchorsは既定空。ADR-0020参照）
labels.json           # Claude Codeセッションが書くラベリング結果（⑦の契約）
```

## ⑨ クリーンアップ仕様

- `submit`成功時: 動画本体（`video.mp4`）と全中間フレーム（`scan/`・`bursts/`）を削除する。残すのは`study_interactions`ごとにStorageへアップロードした代表フレーム1枚のみ
- `fail`時: 作業Dirはそのまま残す（座礁防止・再開用）。`--retry`成功時に掃除する
- review-matchと異なり動画全体を一時的に保持するため、この掃除は逐次実行が前提（ADR-0020）

## ⑩ コンテキスト予算とトリアージ

- **1セッション=1セットを目安**とする（詳細な予算試算はADR-0020 / `.context/design-player-study-draft.md`）
- 窓のトリアージ順: **撃墜（スキャングリッドから目視特定。撃墜エフェクト・リスポーン演出が目印）→ 崖 → 着地 → 残り**。コンテキストが尽きたら残りは次セッションに回す（統計は蓄積型のため分割してよい）

## ⑪ 統計表示

- 択分布はWilson 95%信頼区間付きで表示する
- `n<10`の場面は参考値表示にとどめる（強調しない）
- 各択タップでスクショギャラリー（`t_sec`昇順）+ YouTube `seekTo()`（review-matchの`useYouTubePlayer`を流用）
