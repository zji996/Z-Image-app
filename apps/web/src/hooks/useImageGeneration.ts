import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, cancelTask, generateImage, getImageUrl, getTaskStatus } from "../api/client";
import type { BatchItem } from "../components/GenerationViewer";
import type { ImageSelectionInfo } from "../api/types";
import { useI18n } from "../i18n";
import type { Translator } from "../i18n";
import type { TranslationKey } from "../i18n/translations";

type GenerationStatus = "idle" | "pending" | "generating" | "success" | "error";

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
}

export interface UseImageGenerationOptions {
  authKey: string;
  maxActiveTasks?: number;
  onHistoryUpdated?: () => void;
}

interface UseImageGenerationResult {
  prompt: string;
  setPrompt: (value: string) => void;
  settings: GenerationSettings;
  updateSettings: (updates: Partial<GenerationSettings>) => void;
  status: GenerationStatus;
  imageUrl: string | null;
  error?: string;
  generationTime?: number;
  lastSize: { width: number; height: number } | null;
  isSubmitting: boolean;
  currentBatchMeta: BatchMeta | null;
  currentBatchItems: BatchItem[];
  isCancellingBatch: boolean;
  handleGenerate: () => Promise<void>;
  handleCancelBatch: () => Promise<void>;
  selectImage: (url: string, size?: { width: number; height: number }) => void;
  loadFromHistory: (info: ImageSelectionInfo) => void;
}

const DEFAULT_MAX_ACTIVE_TASKS = 8;

const ERROR_HINT_KEYS: Record<string, TranslationKey> = {
  gpu_oom: "errors.gpuOom",
  dependency_missing: "errors.dependencyMissing",
  model_missing: "errors.modelMissing",
  internal_error: "errors.internal",
  cancelled: "errors.cancelled",
};

const getFriendlyErrorMessage = (
  t: Translator,
  code?: string | null,
  hint?: string | null,
  fallback?: string | null,
) => {
  if (code && ERROR_HINT_KEYS[code]) {
    return t(ERROR_HINT_KEYS[code]);
  }
  if (hint) {
    return hint;
  }
  if (fallback) {
    return fallback;
  }
  return t("errors.generic");
};

export function useImageGeneration(options: UseImageGenerationOptions): UseImageGenerationResult {
  const { authKey, maxActiveTasks = DEFAULT_MAX_ACTIVE_TASKS, onHistoryUpdated } = options;
  const { t } = useI18n();

  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<GenerationSettings>({
    width: 1024,
    height: 1024,
    steps: 8, // Default for Turbo
    guidance: 0.0, // Default for Turbo
    seed: null,
    images: 1,
  });
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lastSize, setLastSize] = useState<{ width: number; height: number } | null>({
    width: 1024,
    height: 1024,
  });
  const [error, setError] = useState<string | undefined>();
  const [generationTime, setGenerationTime] = useState<number | undefined>();
  const [currentBatchMeta, setCurrentBatchMeta] = useState<BatchMeta | null>(null);
  const [currentBatchItems, setCurrentBatchItems] = useState<BatchItem[]>([]);
  const [isCancellingBatch, setIsCancellingBatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollTimers = useRef<Record<string, number>>({});
  const currentBatchIdRef = useRef<string | null>(null);

  const mutateBatchItem = useCallback(
    (batchId: string, taskId: string, transform: (prev: BatchItem | undefined) => BatchItem | undefined) => {
      setCurrentBatchItems((prev) => {
        if (currentBatchIdRef.current !== batchId) {
          return prev;
        }
        const next = [...prev];
        const idx = next.findIndex((item) => item.taskId === taskId);
        const existing = idx >= 0 ? next[idx] : undefined;
        const updated = transform(existing);
        if (!updated) {
          if (idx >= 0) {
            next.splice(idx, 1);
            return next;
          }
          return prev;
        }
        if (idx >= 0) {
          next[idx] = updated;
        } else {
          next.push(updated);
        }
        next.sort((a, b) => a.index - b.index);
        return next;
      });
    },
    [],
  );

  const updateSettings = useCallback((updates: Partial<GenerationSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const batchSize = Math.max(1, settings.images || 1);
    const activeCount = Object.keys(pollTimers.current).length;
    if (activeCount + batchSize > maxActiveTasks) {
      setStatus("error");
      setError(t("errors.tooManyTasks", { active: activeCount, max: maxActiveTasks }));
      return;
    }

    const batchId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    currentBatchIdRef.current = batchId;
    setCurrentBatchMeta({ id: batchId, size: batchSize });
    setCurrentBatchItems([]);
    setIsCancellingBatch(false);
    setStatus("pending");
    setError(undefined);
    setImageUrl(null);
    setGenerationTime(undefined);
    setLastSize({ width: settings.width, height: settings.height });
    setIsSubmitting(true);

    const startSingleTask = async (index: number) => {
      const startTime = performance.now();
      const seed = settings.seed === null || settings.seed === undefined ? null : settings.seed + index;

      try {
        const { task_id } = await generateImage(
          {
            prompt,
            height: settings.height,
            width: settings.width,
            num_inference_steps: settings.steps,
            guidance_scale: settings.guidance,
            seed,
            metadata: {
              batch_id: batchId,
              batch_index: index,
              batch_size: batchSize,
            },
          },
          authKey || "admin",
        );

        if (currentBatchIdRef.current === batchId) {
          setStatus("generating");
        }

        mutateBatchItem(batchId, task_id, () => ({
          taskId: task_id,
          index,
          status: "pending",
        }));

        const clearTimer = () => {
          if (pollTimers.current[task_id]) {
            clearInterval(pollTimers.current[task_id]);
            delete pollTimers.current[task_id];
          }
        };

        const intervalId = window.setInterval(async () => {
          try {
            const response = await getTaskStatus(task_id, authKey || "admin");

            if (response.status === "SUCCESS" && response.result) {
              clearTimer();
              const endTime = performance.now();
              const url = getImageUrl(response.image_url || response.result.relative_path);
              const width = response.result.width;
              const height = response.result.height;

              mutateBatchItem(batchId, task_id, (prev) => ({
                ...(prev ?? { taskId: task_id, index, status: "success" }),
                status: "success",
                imageUrl: url,
                width,
                height,
              }));

              if (currentBatchIdRef.current === batchId) {
                setGenerationTime((endTime - startTime) / 1000);
                setImageUrl(url);
                setLastSize({ width, height });
                setStatus("success");
              }

              if (onHistoryUpdated) {
                onHistoryUpdated();
              }
            } else if (response.status === "FAILURE" || response.status === "REVOKED") {
              clearTimer();
              const friendly = getFriendlyErrorMessage(t, response.error_code, response.error_hint, response.error);
              const finalStatus = response.status === "REVOKED" ? "cancelled" : "error";
              mutateBatchItem(batchId, task_id, (prev) => ({
                ...(prev ?? { taskId: task_id, index, status: finalStatus }),
                status: finalStatus,
                errorCode: response.error_code ?? null,
                errorHint: friendly,
              }));
              if (currentBatchIdRef.current === batchId) {
                setStatus("error");
                setError(friendly);
              }
            } else if (response.status === "STARTED") {
              mutateBatchItem(batchId, task_id, (prev) => ({
                ...(prev ?? { taskId: task_id, index, status: "pending" }),
                status: "running",
              }));
            }
          } catch (err) {
            console.error("Polling error:", err);
            clearTimer();
            mutateBatchItem(batchId, task_id, (prev) => ({
              ...(prev ?? { taskId: task_id, index, status: "error" }),
              status: "error",
              errorHint: t("errors.statusPoll"),
            }));
            if (currentBatchIdRef.current === batchId) {
              setStatus("error");
              setError(t("errors.statusPollHint"));
            }
          }
        }, 500);

        pollTimers.current[task_id] = intervalId;
      } catch (err: unknown) {
        const fallbackMessage = t("errors.failedToStart");
        const message = err instanceof Error && err.message ? err.message : fallbackMessage;
        if (currentBatchIdRef.current === batchId) {
          setStatus("error");
          setError(message || fallbackMessage);
        }
        mutateBatchItem(batchId, `failed-${batchId}-${index}`, () => ({
          taskId: `failed-${batchId}-${index}`,
          index,
          status: "error",
          errorHint: message || fallbackMessage,
        }));
      }
    };

    try {
      const tasks = Array.from({ length: batchSize }, (_, index) => startSingleTask(index));
      await Promise.all(tasks);
    } finally {
      setIsSubmitting(false);
    }
  }, [authKey, maxActiveTasks, mutateBatchItem, onHistoryUpdated, prompt, settings, t]);

  const handleCancelBatch = useCallback(async () => {
    if (!currentBatchMeta) {
      return;
    }
    const cancellableTasks = currentBatchItems.filter((item) => item.status === "pending" || item.status === "running");
    if (cancellableTasks.length === 0) {
      return;
    }

    setIsCancellingBatch(true);
    try {
      await Promise.all(
        cancellableTasks.map((item) =>
          cancelTask(item.taskId, authKey || "admin").catch((err) => {
            console.error("Failed to cancel task", err);
            if (err instanceof ApiError && currentBatchIdRef.current === currentBatchMeta.id) {
              setStatus("error");
              setError(err.message);
            }
          }),
        ),
      );
      cancellableTasks.forEach((item) => {
        mutateBatchItem(currentBatchMeta.id, item.taskId, (prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            status: "cancelled",
            errorHint: t("errors.cancelled"),
          };
        });
      });
    } finally {
      setIsCancellingBatch(false);
    }
  }, [authKey, currentBatchItems, currentBatchMeta, mutateBatchItem, t]);

  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach((id) => clearInterval(id));
      pollTimers.current = {};
    };
  }, []);

  const selectImage = useCallback((url: string, size?: { width: number; height: number }) => {
    setImageUrl(url);
    if (size) {
      setLastSize(size);
    }
    setStatus("success");
  }, []);

  /** 从历史记录加载完整信息到表单 */
  const loadFromHistory = useCallback((info: ImageSelectionInfo) => {
    // 更新图片显示
    setImageUrl(info.imageUrl);
    setStatus("success");
    
    // 更新提示词
    if (info.prompt) {
      setPrompt(info.prompt);
    }
    
    // 更新设置
    const updates: Partial<GenerationSettings> = {};
    if (info.width) updates.width = info.width;
    if (info.height) updates.height = info.height;
    if (info.steps !== undefined) updates.steps = info.steps;
    if (info.guidance !== undefined) updates.guidance = info.guidance;
    if (info.seed !== undefined) updates.seed = info.seed;
    
    if (Object.keys(updates).length > 0) {
      setSettings((prev) => ({ ...prev, ...updates }));
    }
    
    if (info.width && info.height) {
      setLastSize({ width: info.width, height: info.height });
    }
  }, []);

  return {
    prompt,
    setPrompt,
    settings,
    updateSettings,
    status,
    imageUrl,
    error,
    generationTime,
    lastSize,
    isSubmitting,
    currentBatchMeta,
    currentBatchItems,
    isCancellingBatch,
    handleGenerate,
    handleCancelBatch,
    selectImage,
    loadFromHistory,
  };
}
