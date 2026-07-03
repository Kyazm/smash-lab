-- 0004: 自キャラ（メインキャラ）のユーザー選択（ADR-0013 / docs/08 G-2）。
-- set_main_character RPC を追加し、own_play/own_move/own_match の character_id をバックフィルする。
--
-- デプロイ順序厳守（ADR-0013 Consequences）:
--   ①新コード（own_* クエリを character_id IS NULL OR character_id = mainId の両対応）を先にデプロイ
--   ②本migrationを適用
--   ③後続で NULL 両対応を撤去
-- この順序なら稼働中プロダクトを壊さない。

begin;

-- ============================================================
-- set_main_character(): is_main を単一UPDATE文で切り替える（中間で二重trueにしない）。
-- SECURITY DEFINER + search_path固定 + 匿名（is_writer()=false）を弾く（ADR-0014 先取り、
-- 0005でis_writer()関数が定義されるまでは匿名JWTクレームを直接判定する）。
-- ============================================================
create or replace function set_main_character(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'set_main_character: anonymous users cannot write';
  end if;

  perform 1 from characters where id = p_character_id;
  if not found then
    raise exception 'character % not found', p_character_id;
  end if;

  -- Supabase側の安全設定（pg-safeupdate相当）がWHERE句無しUPDATEを拒否するため、
  -- 全行対象であることを明示する where true を付ける（単一UPDATE文の方針自体は変えない）。
  update characters set is_main = (id = p_character_id) where true;
end;
$$;

grant execute on function set_main_character(uuid) to authenticated;

-- ============================================================
-- バックフィル: own_play/own_match は ZSS(zero_suit_samus) に、own_move は move 由来のキャラに。
-- ============================================================
update notes
set character_id = (select id from characters where slug = 'zero_suit_samus')
where kind in ('own_play', 'own_match') and character_id is null;

update notes
set character_id = moves.character_id
from moves
where notes.kind = 'own_move'
  and notes.move_id = moves.id
  and notes.character_id is null;

commit;
