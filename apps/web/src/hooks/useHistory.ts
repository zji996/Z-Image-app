import { useEffect } from "react";
import { useHistoryStore } from "../store/historyStore";
import type { BatchSummary, HistoryError } from "../api/types";

interface UseHistoryResult {
  items: BatchSummary[];
  isLoading: boolean;
  error: HistoryError;
  hasMore: boolean;
  refresh: (clearBeforeFetch?: boolean) => void;
  loadMore: () => void;
  deleteItem: (batchId: string) => Promise<void>;
  deleteMany: (batchIds: string[]) => Promise<void>;
  isDeletingMany: boolean;
}

/**
 * Hook for managing history state
 * Uses Zustand store internally for state management
 */
export function useHistory(authKey: string): UseHistoryResult {
  const {
    items,
    isLoading,
    error,
    hasMore,
    isDeletingMany,
    fetchHistory,
    loadMore: storeLoadMore,
    deleteItem: storeDeleteItem,
    deleteMany: storeDeleteMany,
  } = useHistoryStore();

  // Load history when authKey changes
  useEffect(() => {
    fetchHistory(authKey, true, true);
  }, [authKey, fetchHistory]);

  return {
    items,
    isLoading,
    error,
    hasMore,
    isDeletingMany,
    refresh: (clearBeforeFetch = false) => fetchHistory(authKey, true, clearBeforeFetch),
    loadMore: () => storeLoadMore(authKey),
    deleteItem: (batchId: string) => storeDeleteItem(batchId, authKey),
    deleteMany: (batchIds: string[]) => storeDeleteMany(batchIds, authKey),
  };
}
