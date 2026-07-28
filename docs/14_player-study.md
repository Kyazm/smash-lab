# プレイヤー研究（player-study）— 行動辞書とラベリング基準

**FROZEN (2026-07-27) — W2パイロット2セット（e76F_fDNjf8 vs シュルク 27件 / ZyOYAOsfD6U vs スネーク 38件、計65 interactions）の実測を経て③④を凍結。** 凍結時の判別性実測と根拠は `.context/player-study/pilot-01-feedback.md` / `pilot-02-feedback.md` および ADR-0020 Consequences を参照。以後の変更はADR更新とセットで行う。

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
| `landing_trap` | なし（advantageに内包） | 攻め側の着地狩りを独立集計するため0012で追加（ledge_offense/defenseと同じ攻守分離。`landing`=自分が着地する側、`landing_trap`=相手の着地を狩る側）。0012以前のデータでは着地狩りはadvantageに混在 |

**ライン（0012で追加）**: interactionに任意フィールド`line`（`adv`/`even`/`disadv`）を持てる。ライン＝ステージ上の位置取りの有利/五分/不利で、situation（読み合いの主導権）とは独立の軸。判別が容易（画面上の位置関係）なのでラベリング時に可能な限り記録する。0012以前のデータはnull。

`habit_tags`（docs/13のhabit_tag語彙、15語）とも別語彙。両者を混同しない。

## ③ 崖の語彙（正準6分類+攻め側行動）— FROZEN

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

- **`ledge_defense`**（研究対象が崖を掴んでいる側）: `action`に上記6分類のslugを入れる（=本人の上がり択を数える）。`sub_situation`は相手の待ち位置等の補足（任意）。**崖を掴んでいない崖際の被圧力は`ledge_defense`にしない**（`disadvantage`か`recovery`を使う。パイロットで混同事例あり）
- **`ledge_offense`**(研究対象が崖を攻める側): `action`に攻め側の選択を入れる — 技slug（`down_smash`等）、`ledge_trump`（崖奪い）、`wait_center`（位置取り待機）等。2フレ狙いは技slug+`action_detail`に「2フレ」と書く。`sub_situation`には**相手が選んだ上がり択（上記6分類）**を入れる（=どの択に勝った/負けたかを集計するため）

**凍結記録（W2実測）**: 崖行動slug（6分類+`ledge_trump`+`wait_center`）は`labels-schema.ts`の`ACTION_LEDGE_SLUGS`として正式収録済み（W1時点の収録漏れをパイロットで発見・修正）。トップレベルの崖攻防は「復帰技への空中迎撃=`edgeguard`」が主体で、静的な崖上がり読み合いは2セットで2件しか発生しなかった。相手の復帰が崖掴みを経ない場合（スネークのサイファー等）は`edgeguard`とし、`sub_situation`に復帰形を書く（推奨語彙: `cypher_recovery` / `tether_recovery` / `high_recovery`。自由記述のまま、enumにはしない）。上がり6択の細分類は10fpsでは`jump_getup`以外判別困難のため、崖掴みを検知したら高fps再バースト（⑩参照）を推奨。

## ④ ZSS行動辞書 v1 — FROZEN

`action`は粗カテゴリを必須、個別技slugは視認が容易なものだけ許可する二層構成にする（v1で全技を個別slug化すると判別コストが高く、pilotで一致率を見てから昇格させる方針）。

**粗カテゴリ（必須）**

`aerial` / `ground_attack` / `smash` / `grab` / `special` / `shield_action` / `movement` / `ledge_option`

**視認容易な個別技slug（粗カテゴリの詳細として付与可）**

| slug | 技 | 備考 |
|---|---|---|
| `zair` | 空N（鞭）先端差し込み | 鞭の視覚的特徴が明瞭で判別しやすい（実測conf 0.6） |
| `down_smash` | 下スマッシュ | 崖の2フレ択の主力 |
| `boost_kick` | 上B | 青い縦柱の多段ヒットトレイル+本人も一緒に上昇、が判別根拠（実測conf 0.65-0.85） |
| `flip_jump` | 下B | |
| `plasma_whip` | 横B | 10fpsでは掴み（テザー）と混同しやすい。断定できない時は`special`+`action_detail` |
| `paralyzer` | NB（スタンガン） | |
| `up_smash` | 上スマッシュ | W2で追加。接地したまま上方向の電撃バーストが判別根拠。`boost_kick`（本人が上昇）との違いに注意 |

このほか崖行動slug（③の6分類+`ledge_trump`+`wait_center`）も`action`に使える（`ACTION_LEDGE_SLUGS`）。

**空中技の扱い（凍結）**: `nair`/`bair`/`uair`等の個別slug昇格は**否決**。2セットの実測で、10fps/480p+撃墜時のカメラ引き・ヒットエフェクトにより個別判別は不可能と確認（円形エフェクト等で推定できても conf 0.5前後止まり）。`aerial` + `action_detail`に推定と根拠を書く運用を正とする。

**撃墜技の運用注記（凍結）**: `kill=true`（撃墜の事実）はストック差オーバーレイ/GAME!で高信頼に取れるが、撃墜技のslug判別は別問題。無理に個別slugを付けず粗カテゴリ+`action_detail`でよい。統計の主軸は situation×outcome×kill であり、技分布は`confidence>=0.6`が溜まった場面から読む。

**判別不能時**: `action='unknown'` + `confidence`を記録する（⑤参照、統計からは除外）。

## ⑤ confidenceとunknownの扱い（凍結規則）

- `confidence`は0〜1の主観値。低confidence（**<0.6**）と`action='unknown'`は**統計の分母から除外**し、UI上は別バケット（「判別不能」等）として件数のみ表示する
- 除外基準そのものは凍結対象（`docs/14`のこの節を変える時はADR-0020を更新してから反映する）

## ⑥ ラベリング手順（side / opp_char / outcome）

- **side確定**: 各ゲーム開始時にHUDのプレイヤータグ（P1/P2表示）でどちらがstudied_playerかを判定し、`side('p1'|'p2')`をゲーム単位で記録する
- **opp_char確定**: `opp_char`はゲーム単位でラベリング時に目視確定する（カウンターピック対応。動画タイトルのキャラ名パースは`opp_chars_hint`としてヒント止まりにし、正としない）
- **outcome判定基準**: studied_player視点で、読み合い直後にダメージまたは位置優位を取った側を`won`、取られた側を`lost`、優劣つかずを`even`とする。撃墜に至った場合は`kill=true`を別フラグで立てる（`outcome`とは独立。例: 不利な状況から一発逆転で撃墜しても`outcome='lost', kill=true`はあり得る）
- **kill_confirmの境界（W2で凍結）**: `kill_confirm`は「撃墜を確定させた最後の読み合い1件」のみ。撃墜前の布石（お手玉・場外への運び）は`advantage`または`edgeguard`として別interactionにする
- **edgeguardのoutcome（W2で凍結）**: 撃墜狙いのedgeguard（目安: 相手が撃墜%帯≒100%以上）で相手に生存されたら、ダメージを与えていても`even`。撃墜%帯未満のダメージ/位置目的のedgeguardは通常基準（ダメージを取れば`won`）
- **リスポーン無敵絡み**: 相手の無敵時間に絡んで一方的に負けた場面はMarssの択が観測できず`action='unknown'`になりやすい。無理に埋めず`confidence`で正直に落とす

**W4バッチ（8セット）で明文化した運用規則**:
- `kill=true`は**studied_playerが撃墜を取った時のみ**。被撃墜は`outcome='lost'`+`kill=false`（被撃墜%はnoteに記録）。分業ラベリングでは必ずプロンプトに明記する（解釈ブレが実際に発生した）
- `kill_confirm`と`edgeguard`+killの境界は**撃墜が起きた場所**: 場外での撃墜=`edgeguard`+kill、ステージ上の確定択=`kill_confirm`
- 場外追撃の**見送り**（相手を場外に出したが降りない判断）は`edgeguard`+`wait_center`で記録する（wait_centerはledge_offense専用ではない）
- 被撃墜時のsituationは**直前にstudied_playerがしていた行動**で選ぶ: 着地を狩られた=`landing`、復帰を狩られた=`recovery`、地上の差し合い=`neutral`
- edgeguardのeven判定の「撃墜%帯」目安は相手キャラの重さで補正してよい（重量級は~130%目安）。判断理由をnoteに書く

## ⑦ labels.json契約

```
{
  games: [{
    game_index, opp_char, side('p1'|'p2'),
    interactions: [{
      t_sec, situation, sub_situation?, action, action_detail?,
      outcome('won'|'lost'|'even'), kill?, confidence,
      line?,   -- 'adv'|'even'|'disadv'（ライン=位置取り。0012で追加、任意だが可能な限り記録）
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

- **1セッション=1セットを目安**とする（詳細な予算試算はADR-0020 / `.context/design-player-study-draft.md`）。サブエージェント分業（スキャン2体+ゲーム別ラベリング）の場合は1セッションで1セット全体を回せる（W2実績）
- 窓のトリアージ順: **撃墜（スキャングリッドから目視特定。撃墜エフェクト・リスポーン演出・ストック差オーバーレイが目印）→ 崖 → 着地 → 残り**。コンテキストが尽きたら残りは次セッションに回す（統計は蓄積型のため分割してよい）
- **zoomパラメータ（W2で凍結した運用値）**:
  - KO窓: ストック差オーバーレイ秒を`--t`に、`--before 5 --span 6`（[t-5, t+1]）。布石とKO確定を1バーストで捉えられる
  - 技判別は撃墜ヒット時でなく**その0.3〜0.5秒前（カメラズーム前）のフレーム**を主眼にする
  - 崖掴みを検知したら、掴み時刻+3〜4秒に後続バーストを1本追加。上がり6択の細分類が必要なら`--fps 20`で再取得
  - フレームは間引き読み（3枚おき→決定的瞬間のみ密に）。全読みしない
  - **KO%はバースト実測値を正とする**。1fpsスキャンの%は撃墜打の加算前で最大15-20%過小になる（W4で多数実測）
  - 視覚判別の補助（W4実測）: シールド球はP1=赤系/P2=青白でプレイヤー識別に使える（強ヒットの放射バーストとは「球内にキャラが立っているか」で区別）。`boost_kick`は「本人も相手と一緒に上昇+多段ヒット+直後しりもち落下」が決め手。`plasma_whip`/横スマ/掴みはグラフィックが酷似するためダメージ量（1on1補正1.2倍込み）で補助判別する

## ⑪ 統計表示

- 択分布はWilson 95%信頼区間付きで表示する
- `n<10`の場面は参考値表示にとどめる（強調しない）
- 各択タップでスクショギャラリー（`t_sec`昇順）+ YouTube `seekTo()`（review-matchの`useYouTubePlayer`を流用）
