# ADR-0012: 画像バケットの公開とメモ内リッチ埋め込み

Status: Accepted (2026-07-03)

## Context
Discordから移行したメモは本文に画像プレースホルダ（`attachment://<id>/<name>`）とURL（Twitter 41件・YouTube 100件超・discord CDN・画像直リンク等）を平文で持つが、(a) 添付32枚がStorage未アップロードで表示できず、(b) 現状のMarkdownレンダラはURLをリンク化すらしていなかった。ユーザー要望: 画像とTwitter等を画面埋め込みで表示したい。

## Decision
- **note-media バケットを public-read にする**（ユーザー選択、2026-07-03）。ゲーム画面のスクリーンショットはYouTube限定公開クリップ（ADR-0007）と同じ「URL到達者に見える」機密性クラスとして許容。パスはUUID的で推測困難。`resolveImageUrl` は同期の `getPublicUrl` のまま
- Discord添付32枚を `discord/<id>_<name>` へアップロード済み（`.context/upload-discord-images.py`、冪等）
- **Markdownレンダラのリッチ化**（`web/src/lib/markdown.tsx` を拡張、依存追加なしを維持）:
  - `attachment://<id>/<name>` → storage_path `discord/<id>_<name>` へ変換し `getPublicUrl` で `<img>` 埋め込み
  - 画像直リンク（拡張子 or 既知CDN）→ `<img>`。**discord CDNの署名付きURLは失効するため**、失効時は代替として note_media のミラー画像にフォールバック（同一attachmentId基準）
  - YouTube（youtube.com / youtu.be、`t=`開始秒対応）→ 埋込プレイヤー（既存 youtube.ts 再利用）
  - Twitter/X → 公式 widgets.js を遅延ロードして blockquote 埋め込み。スクリプト失敗時はリンクにフォールバック（プライバシー配慮でツイート含有メモの表示時のみロード）
  - その他URL → クリック可能リンク（新規タブ・`rel=noreferrer`）
- 生HTMLは引き続き解釈しない（XSS安全）。埋め込みは許可したホストのみ

## Consequences
- 移行メモの画像・動画・ツイートがそのまま閲覧可能になり、Discord運用の資産価値を完全に引き継ぐ
- 画像バケットが公開になる（機密性の低いゲーム画面に限定。テキスト考察はauth-gatedのまま）
- Twitter widgets.js は外部スクリプト依存。失効・ブロック時はリンク表示に劣化（許容）
- discord CDN直リンクは失効済みが多く、ミラー画像へのフォールバックが実質の表示経路になる
