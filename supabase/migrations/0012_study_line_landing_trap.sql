-- 0012: player-study 語彙拡張（ユーザーレビュー 2026-07-27 反映。ADR-0020 Consequences 追記とセット）。
-- (1) situation に 'landing_trap'（着地狩り）を追加。従来は「有利」に内包されていた攻め側の着地狩りを、
--     崖の ledge_offense/ledge_defense と同じ理由（集計軸として攻守を分離）で独立させる。
--     既存行は変更しない（過去の「有利」内の着地狩りはそのまま。今後のラベリングから分離）。
-- (2) study_interactions.line を追加（nullable）。ライン＝ステージ上の位置取りの有利/五分/不利。
--     situation（読み合いの主導権）とは独立の軸。既存行は null（記録なし）。

begin;

alter table study_interactions drop constraint study_interactions_situation_check;
alter table study_interactions add constraint study_interactions_situation_check
  check (situation in ('neutral','advantage','disadvantage',
                       'ledge_offense','ledge_defense','landing','landing_trap',
                       'edgeguard','recovery','kill_confirm'));

alter table study_interactions add column line text
  check (line in ('adv','even','disadv'));

comment on column study_interactions.line is
  'ライン（位置取り）の有利/五分/不利。situation とは独立の軸。0012 以降のラベリングで任意記録';

commit;
