import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, deleteHistoryItem, getHistory } from "../api/client";
import type { TaskSummary } from "../api/types";
import type { HistoryError } from "../types/history";

type LoadHistoryOptions = {
  reset?: boolean;
  clearBeforeFetch?: boolean;
};

const HISTORY_PAGE_SIZE = 24;

interface UseHistoryResult {
  items: TaskSummary[];
  isLoading: boolean;
  error: HistoryError;
  hasMore: boolean;
  refresh: (clearBeforeFetch?: boolean) => void;
  loadMore: () => void;
  deleteItem: (taskId: string) => Promise<void>;
}

export function useHistory(authKey: string): UseHistoryResult {
  const [items, setItems] = useState<TaskSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<HistoryError>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const loadHistory = useCallback(
    async ({ reset = false, clearBeforeFetch = false }: LoadHistoryOptions = {}) => {
      if (reset) {
        offsetRef.current = 0;
        if (clearBeforeFetch) {
          setItems([]);
        }
        setHasMore(true);
      }

      setError(null);
      setIsLoading(true);

      try {
        const offset = reset ? 0 : offsetRef.current;
        const fetched = await getHistory(authKey || "admin", HISTORY_PAGE_SIZE, offset);

        setItems((prev) => (reset ? fetched : [...prev, ...fetched]));
        offsetRef.current = offset + fetched.length;
        setHasMore(fetched.length === HISTORY_PAGE_SIZE);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setError("unauthorized");
          setItems([]);
          offsetRef.current = 0;
          setHasMore(false);
        } else {
          console.error("Failed to fetch history", err);
          setError("unknown");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [authKey],
  );

  const refresh = useCallback(
    (clearBeforeFetch = false) => {
      void loadHistory({ reset: true, clearBeforeFetch });
    },
    [loadHistory],
  );

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) {
      return;
    }
    void loadHistory();
  }, [isLoading, hasMore, loadHistory]);

  const deleteItem = useCallback(
    async (taskId: string) => {
      try {
        await deleteHistoryItem(taskId, authKey || "admin");
        // Keep both HistoryPage and sidebar in sync.
        refresh(true);
      } catch (err) {
        console.error("Failed to delete history item", err);
        throw err;
      }
    },
    [authKey, refresh],
  );

  useEffect(() => {
    refresh(true);
  }, [authKey, refresh]);

  return {
    items,
    isLoading,
    error,
    hasMore,
    refresh,
    loadMore,
    deleteItem,
  };
}
