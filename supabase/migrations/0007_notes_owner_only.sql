-- 0007: notes / note_media の SELECT をオーナー限定に。
-- キャラ対メモ・自キャラメモはオーナー個人の考察であり、ゲスト（非オーナー）に見せるべきでない。
-- 0005 で SELECT を全 authenticated 開放していたが、ゲストのサンドボックスがオーナーの実メモを
-- スナップショットで露出していた。提案(0006)と同様に本体メモも is_writer() 限定へ塞ぐ。
--
-- 影響なし: ライブラリ記事は docs/*.md のビルド時バンドル（notesテーブル非依存）。フレームデータ/確反も
-- バンドルJSON。ゲストは公開情報のみ閲覧でき、メモは自分のローカルサンドボックスに追加できる（実データ不変）。
-- 書込(insert/update/delete)は既に is_writer() 限定のため変更しない。

drop policy if exists notes_select_all on notes;
create policy notes_select_writer on notes
  for select to authenticated
  using (public.is_writer());

drop policy if exists note_media_select_all on note_media;
create policy note_media_select_writer on note_media
  for select to authenticated
  using (public.is_writer());
