// プレイヤー研究データの取得フック（useReviews.ts の規約: 手動reload、error: string|null、null=読込中）。
// docs/14_player-study.md ⑪統計表示: /study ページで使用する。オーナー専用（RLSがselectもis_writer()限定）。
import { useCallback, useEffect, useState } from "react";
import { fetchStudyDataset } from "../data/study/studyApi";
import type { StudyDataset } from "../data/study/types";

export interface UseStudyResult {
  /** null=読込中（取得失敗時は空データセットに落としてerrorを立てる）。 */
  data: StudyDataset | null;
  error: string | null;
  reload: () => Promise<void>;
}

export function useStudy(): UseStudyResult {
  const [data, setData] = useState<StudyDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setData(await fetchStudyDataset());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData({ videos: [], interactions: [] });
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}
