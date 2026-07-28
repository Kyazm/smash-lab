// /study のフィルタ（docs/14_player-study.md ⑪）。場面9種・相手キャラ・研究対象プレイヤーの3軸。
// モバイルファースト: チップは min-h-11（44px）でタップターゲットを確保し、横に折り返す。
import type { ReactNode } from "react";
import { CharacterIcon } from "../shared/CharacterIcon";
import {
  STUDY_SITUATIONS,
  STUDY_SITUATION_HINTS,
  STUDY_SITUATION_LABELS,
  type StudySituation,
} from "../../data/study/types";
import type { FacetOption, StudyFilter } from "../../lib/studyStats";
import type { Character } from "../../types";

const CHIP_BASE =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors";
const CHIP_ON = "bg-action text-white";
const CHIP_OFF = "bg-surface-2 text-ink-secondary hover:text-ink-primary";

function Chip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`${CHIP_BASE} ${active ? CHIP_ON : CHIP_OFF}`}
    >
      {children}
    </button>
  );
}

/** チップ右肩の件数バッジ。0件は薄く出す（「データがまだ無い場面」だと分かるようにするため）。 */
function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={`font-frame text-[10px] tabular-nums ${
        active ? "text-white/75" : count === 0 ? "text-ink-muted/60" : "text-ink-muted"
      }`}
    >
      {count}
    </span>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-frame text-[10px] uppercase tracking-[0.18em] text-ink-muted">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function StudyFilterBar({
  filter,
  onChange,
  situationCounts,
  oppFacets,
  playerFacets,
  charByName,
}: {
  filter: StudyFilter;
  onChange: (next: StudyFilter) => void;
  /** 場面別の件数（分母規則適用前の生件数。フィルタで何件残るかの目安）。 */
  situationCounts: Record<StudySituation, number>;
  oppFacets: FacetOption[];
  playerFacets: FacetOption[];
  /** 相手キャラ名(name_ja) → Character。アイコン表示に使う。未登録名はテキストのみ。 */
  charByName: Map<string, Character>;
}) {
  return (
    <div className="space-y-3">
      {/* 研究対象プレイヤー。現状Marssのみだが将来増えるので1人でも軸として出す。 */}
      {playerFacets.length > 0 ? (
        <Section label="プレイヤー">
          <Chip active={filter.player === null} onClick={() => onChange({ ...filter, player: null })}>
            全員
          </Chip>
          {playerFacets.map((f) => (
            <Chip
              key={f.value}
              active={filter.player === f.value}
              onClick={() =>
                onChange({ ...filter, player: filter.player === f.value ? null : f.value })
              }
            >
              {f.value}
              <CountBadge count={f.count} active={filter.player === f.value} />
            </Chip>
          ))}
        </Section>
      ) : null}

      {oppFacets.length > 0 ? (
        <Section label="相手キャラ">
          <Chip
            active={filter.oppChar === null}
            onClick={() => onChange({ ...filter, oppChar: null })}
          >
            全キャラ
          </Chip>
          {oppFacets.map((f) => {
            const c = charByName.get(f.value);
            const active = filter.oppChar === f.value;
            return (
              <Chip
                key={f.value}
                active={active}
                onClick={() => onChange({ ...filter, oppChar: active ? null : f.value })}
              >
                {c ? <CharacterIcon character={c} size="sm" className="h-5 w-5" /> : null}
                {f.value}
                <CountBadge count={f.count} active={active} />
              </Chip>
            );
          })}
        </Section>
      ) : null}

      <Section label="場面">
        <Chip
          active={filter.situation === null}
          onClick={() => onChange({ ...filter, situation: null })}
        >
          全場面
        </Chip>
        {STUDY_SITUATIONS.map((s) => {
          const active = filter.situation === s;
          return (
            <Chip
              key={s}
              active={active}
              title={STUDY_SITUATION_HINTS[s]}
              onClick={() => onChange({ ...filter, situation: active ? null : s })}
            >
              {STUDY_SITUATION_LABELS[s]}
              <CountBadge count={situationCounts[s]} active={active} />
            </Chip>
          );
        })}
      </Section>
    </div>
  );
}
