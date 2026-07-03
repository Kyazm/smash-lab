-- 0006: 承認待ち提案(note_proposals)をオーナー限定に。
-- 提案はオーナー個人のAI整頓レビューキューであり、ゲスト（非オーナー）からは見えるべきでない。
-- 0005 で SELECT を全 authenticated 開放にしていた note_proposals のみ is_writer() 限定へ変更。
-- （notes 本体はゲストのスナップショット閲覧に必要なため SELECT 開放のまま。提案だけを塞ぐ）

drop policy if exists note_proposals_select_all on note_proposals;

create policy note_proposals_select_writer on note_proposals
  for select to authenticated
  using (public.is_writer());
