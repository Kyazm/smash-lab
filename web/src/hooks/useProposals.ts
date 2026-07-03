// 指定ノートのAI整頓提案(pending優先)を購読するフック（docs/06 A-3 / ADR-0010）。
import { useCallback, useEffect, useState } from "react";
import { notesProvider } from "../data/notes";
import type { NoteProposal } from "../data/notes/types";

export interface UseProposalsResult {
  proposals: NoteProposal[] | null;
  error: string | null;
  reload: () => Promise<void>;
  apply: (proposalId: string) => Promise<"accepted" | "stale">;
  reject: (proposalId: string) => Promise<void>;
}

export function useProposals(noteId: string): UseProposalsResult {
  const [proposals, setProposals] = useState<NoteProposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const list = await notesProvider.listProposals(noteId);
      setProposals(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProposals([]);
    }
  }, [noteId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const list = await notesProvider.listProposals(noteId);
        if (!cancelled) setProposals(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setProposals([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const apply = useCallback(
    async (proposalId: string) => {
      const result = await notesProvider.applyProposal(proposalId);
      await reload();
      return result;
    },
    [reload],
  );

  const reject = useCallback(
    async (proposalId: string) => {
      await notesProvider.rejectProposal(proposalId);
      await reload();
    },
    [reload],
  );

  return { proposals, error, reload, apply, reject };
}
