import { create } from "zustand";
import { ApiError, deleteHistoryItem, getHistory } from "../api/client";
import type { BatchSummary, HistoryError } from "../api/types";

const HISTORY_PAGE_SIZE = 24;

interface HistoryState {
  // State
  items: BatchSummary[];
  isLoading: boolean;
  error: HistoryError;
  hasMore: boolean;
  isDeletingMany: boolean;
  offset: number;

  // Actions
  setItems: (items: BatchSummary[] | ((prev: BatchSummary[]) => BatchSummary[])) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: HistoryError) => void;
  setHasMore: (hasMore: boolean) => void;
  setIsDeletingMany: (isDeletingMany: boolean) => void;
  resetOffset: () => void;
  incrementOffset: (count: number) => void;

  // Async Actions
  fetchHistory: (authKey: string, reset?: boolean, clearBeforeFetch?: boolean) => Promise<void>;
  loadMore: (authKey: string) => Promise<void>;
  deleteItem: (batchId: string, authKey: string) => Promise<void>;
  deleteMany: (batchIds: string[], authKey: string) => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  // Initial State
  items: [],
  isLoading: false,
  error: null,
  hasMore: true,
  isDeletingMany: false,
  offset: 0,

  // Simple Setters
  setItems: (itemsOrUpdater) =>
    set((state) => ({
      items: typeof itemsOrUpdater === "function" ? itemsOrUpdater(state.items) : itemsOrUpdater,
    })),
  setIsLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setHasMore: (hasMore) => set({ hasMore }),
  setIsDeletingMany: (isDeletingMany) => set({ isDeletingMany }),
  resetOffset: () => set({ offset: 0 }),
  incrementOffset: (count) => set((state) => ({ offset: state.offset + count })),

  // Async Actions
  fetchHistory: async (authKey, reset = false, clearBeforeFetch = false) => {
    const state = get();
    
    if (reset) {
      set({ offset: 0, hasMore: true });
      if (clearBeforeFetch) {
        set({ items: [] });
      }
    }

    set({ error: null, isLoading: true });

    try {
      const offset = reset ? 0 : state.offset;
      const fetched = await getHistory(authKey || "admin", HISTORY_PAGE_SIZE, offset);

      set((s) => ({
        items: reset ? fetched : [...s.items, ...fetched],
        offset: offset + fetched.length,
        hasMore: fetched.length === HISTORY_PAGE_SIZE,
        isLoading: false,
      }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({
          error: "unauthorized",
          items: [],
          offset: 0,
          hasMore: false,
          isLoading: false,
        });
      } else {
        console.error("Failed to fetch history", err);
        set({ error: "unknown", isLoading: false });
      }
    }
  },

  loadMore: async (authKey) => {
    const { isLoading, hasMore, fetchHistory } = get();
    if (isLoading || !hasMore) return;
    await fetchHistory(authKey, false, false);
  },

  deleteItem: async (batchId, authKey) => {
    const { fetchHistory } = get();
    try {
      await deleteHistoryItem(batchId, authKey || "admin");
      // Refresh list after deletion
      await fetchHistory(authKey, true, true);
    } catch (err) {
      console.error("Failed to delete batch", err);
      throw err;
    }
  },

  deleteMany: async (batchIds, authKey) => {
    if (!batchIds.length) return;
    
    const { fetchHistory } = get();
    set({ isDeletingMany: true });
    
    try {
      await Promise.all(
        batchIds.map((id) =>
          deleteHistoryItem(id, authKey || "admin").catch((err) => {
            console.error(`Failed to delete batch ${id}`, err);
          })
        )
      );
      await fetchHistory(authKey, true, true);
    } finally {
      set({ isDeletingMany: false });
    }
  },
}));

/**
 * Custom hook that wraps historyStore with authKey binding
 * Provides a similar interface to the original useHistory hook
 */
export function useHistoryFromStore(authKey: string) {
  const store = useHistoryStore();
  
  return {
    items: store.items,
    isLoading: store.isLoading,
    error: store.error,
    hasMore: store.hasMore,
    isDeletingMany: store.isDeletingMany,
    refresh: (clearBeforeFetch = false) => store.fetchHistory(authKey, true, clearBeforeFetch),
    loadMore: () => store.loadMore(authKey),
    deleteItem: (batchId: string) => store.deleteItem(batchId, authKey),
    deleteMany: (batchIds: string[]) => store.deleteMany(batchIds, authKey),
  };
}

