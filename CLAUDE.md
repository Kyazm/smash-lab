# smash-lab

スマブラSP上達用の個人ツール。設計は docs/ を正とする。実装前に必ず docs/01〜03 とADRを読むこと。

## ルール

- 設計変更はADR追加とdocs更新をセットで行う
- 一時ファイルは `.context/` に置く（gitignore済み想定）
- `notes`（自分の考察）へ自動書込するコードは書かない（ADR-0004）
- APIキー・service roleキーはコミット禁止（`.env`、git管理外）
- フレームデータは静的（Ver.13.0.1最終）。更新同期の仕組みは作らない

## 用語

- ZSS = ゼロスーツサムス（使用キャラ）
- OoS = Out of Shield、ガード中からの反撃行動
- UFD = ultimateframedata.com（フレームデータ取得元）
- intel = 外部収集情報（自分メモとは分離、inbox→採用で昇格）
