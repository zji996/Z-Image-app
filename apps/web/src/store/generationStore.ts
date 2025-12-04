import { create } from "zustand";
import type { BatchItem, GenerationStatus } from "../api/types";

export interface GenerationSettings {
  width: number;
  height: number;
  steps: number;
  guidance: number;
  seed: number | null;
  images: number;
}

export interface BatchMeta {
  id: string;
  size: number;
  completed?: number;
  failed?: number;
}

interface GenerationState {
  // Prompt & Settings
  prompt: string;
  settings: GenerationSettings;

  // Generation State
  status: GenerationStatus;
  imageUrl: string | null;
  error: string | undefined;
  generationTime: number | undefined;
  lastSize: { width: number; height: number } | null;
  isSubmitting: boolean;

  // Batch State
  currentBatchMeta: BatchMeta | null;
  currentBatchItems: BatchItem[];
  isCancellingBatch: boolean;

  // Actions - Prompt & Settings
  setPrompt: (prompt: string) => void;
  updateSettings: (updates: Partial<GenerationSettings>) => void;
  resetSettings: () => void;

  // Actions - Generation State
  setStatus: (status: GenerationStatus) => void;
  setImageUrl: (url: string | null) => void;
  setError: (error: string | undefined) => void;
  setGenerationTime: (time: number | undefined) => void;
  setLastSize: (size: { width: number; height: number } | null) => void;
  setIsSubmitting: (isSubmitting: boolean) => void;

  // Actions - Batch State
  setCurrentBatchMeta: (meta: BatchMeta | null) => void;
  setCurrentBatchItems: (items: BatchItem[] | ((prev: BatchItem[]) => BatchItem[])) => void;
  setIsCancellingBatch: (isCancelling: boolean) => void;

  // Composite Actions
  resetGeneration: () => void;
  initBatch: (batchId: string, batchSize: number, width: number, height: number) => void;
}

const DEFAULT_SETTINGS: GenerationSettings = {
  width: 1024,
  height: 1024,
  steps: 8,
  guidance: 0.0,
  seed: null,
  images: 1,
};

const DEFAULT_SIZE = { width: 1024, height: 1024 };

export const useGenerationStore = create<GenerationState>((set, get) => ({
  // Initial State - Prompt & Settings
  prompt: "",
  settings: DEFAULT_SETTINGS,

  // Initial State - Generation
  status: "idle",
  imageUrl: null,
  error: undefined,
  generationTime: undefined,
  lastSize: DEFAULT_SIZE,
  isSubmitting: false,

  // Initial State - Batch
  currentBatchMeta: null,
  currentBatchItems: [],
  isCancellingBatch: false,

  // Actions - Prompt & Settings
  setPrompt: (prompt) => set({ prompt }),
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),
  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

  // Actions - Generation State
  setStatus: (status) => set({ status }),
  setImageUrl: (imageUrl) => set({ imageUrl }),
  setError: (error) => set({ error }),
  setGenerationTime: (generationTime) => set({ generationTime }),
  setLastSize: (lastSize) => set({ lastSize }),
  setIsSubmitting: (isSubmitting) => set({ isSubmitting }),

  // Actions - Batch State
  setCurrentBatchMeta: (currentBatchMeta) => set({ currentBatchMeta }),
  setCurrentBatchItems: (itemsOrUpdater) =>
    set((state) => ({
      currentBatchItems:
        typeof itemsOrUpdater === "function"
          ? itemsOrUpdater(state.currentBatchItems)
          : itemsOrUpdater,
    })),
  setIsCancellingBatch: (isCancellingBatch) => set({ isCancellingBatch }),

  // Composite Actions
  resetGeneration: () =>
    set({
      status: "idle",
      imageUrl: null,
      error: undefined,
      generationTime: undefined,
      currentBatchMeta: null,
      currentBatchItems: [],
      isCancellingBatch: false,
      isSubmitting: false,
    }),

  initBatch: (batchId, batchSize, width, height) =>
    set({
      status: "pending",
      error: undefined,
      imageUrl: null,
      generationTime: undefined,
      lastSize: { width, height },
      isSubmitting: true,
      isCancellingBatch: false,
      currentBatchMeta: { id: batchId, size: batchSize },
      currentBatchItems: Array.from({ length: batchSize }, (_, i) => ({
        taskId: `pending-${batchId}-${i}`,
        index: i,
        status: "pending" as const,
      })),
    }),
}));
