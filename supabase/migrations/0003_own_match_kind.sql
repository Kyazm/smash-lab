-- 0003: 「試合」タブ用に kind='own_match' を追加（docs/07 F-B）。
-- 「自分の試合」メモを own_play から own_match へ再分類し、立ち回りタブから分離する。
-- 将来の手動試合メモ・Gemini試合レビュー出力（Phase 3）もこのkindに入る。

alter table notes drop constraint if exists notes_kind_check;
alter table notes
  add constraint notes_kind_check
  check (kind in ('own_play','own_move','matchup','player','own_match'));

-- 既存の「自分の試合」ノート（own_play, tag=基本）を own_match へ。tagsは残す。
update notes
set kind = 'own_match'
where kind = 'own_play' and title = '自分の試合';
