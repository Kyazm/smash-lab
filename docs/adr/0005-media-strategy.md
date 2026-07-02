# ADR-0005: メディア三層戦略

Status: Accepted (2026-07-03) / フル試合録画の行はADR-0007で置き換え

## Context
Supabase無料枠のStorageは1GBで動画を置けない。メモ埋込クリップとフル試合録画では要件が違う。

## Decision
| 種別 | 置き場所 |
|---|---|
| 画像 | Supabase Storage |
| メモ埋込の短尺クリップ | YouTube限定公開（埋込） |
| フル試合録画 | ~~Macローカル~~ → YouTube限定公開（ADR-0007） |

## Consequences
- 無料枠内で全要件を満たす
- YouTube限定公開はURL到達者に視聴されうる（ゲームクリップのため許容）
- フル録画はMac依存。バックアップは既存のバックアップ運用に委ねる
