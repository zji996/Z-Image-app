import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, cancelTask, generateImage, getImageUrl, getTaskStatus } from "../api/client";
import type { BatchPreviewItem } from "../components/BatchPreview";

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
  handleSettingsChange: (key: keyof GenerationSettings, value: number | null) => void;
  status: GenerationStatus;
  imageUrl: string | null;
  error?: string;
  generationTime?: number;
  lastSize: { width: number; height: number } | null;
  isSubmitting: boolean;
  currentBatchMeta: BatchMeta | null;
  currentBatchItems: BatchPreviewItem[];
  isCancellingBatch: boolean;
  handleGenerate: () => Promise<void>;
  handleCancelBatch: () => Promise<void>;
  selectImage: (url: string, size?: { width: number; height: number }) => void;
}

const DEFAULT_MAX_ACTIVE_TASKS = 8;

const ERROR_HINT_MAP: Record<string, string> = {
  gpu_oom: "GPU 显存不足，请降低分辨率或 steps 后重试。",
  dependency_missing: "推理环境缺少必要依赖，请检查 worker 日志。",
  model_missing: "未找到模型权重，请先准备 MODELS_DIR。",
  internal_error: "生成过程中出现未知异常，请稍后再试。",
  cancelled: "任务已取消。",
};

const getFriendlyErrorMessage = (code?: string | null, hint?: string | null, fallback?: string | null) => {
  if (code && ERROR_HINT_MAP[code]) {
    return ERROR_HINT_MAP[code];
  }
  if (hint) {
    return hint;
  }
  if (fallback) {
    return fallback;
  }
  return "任务失败，请稍后重试。";
};

export function useImageGeneration(options: UseImageGenerationOptions): UseImageGenerationResult {
  const { authKey, maxActiveTasks = DEFAULT_MAX_ACTIVE_TASKS, onHistoryUpdated } = options;

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
  const [currentBatchItems, setCurrentBatchItems] = useState<BatchPreviewItem[]>([]);
  const [isCancellingBatch, setIsCancellingBatch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollTimers = useRef<Record<string, number>>({});
  const currentBatchIdRef = useRef<string | null>(null);

  const mutateBatchItem = useCallback(
    (batchId: string, taskId: string, transform: (prev: BatchPreviewItem | undefined) => BatchPreviewItem | undefined) => {
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

  const handleSettingsChange = (key: keyof GenerationSettings, value: number | null) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const batchSize = Math.max(1, settings.images || 1);
    const activeCount = Object.keys(pollTimers.current).length;
    if (activeCount + batchSize > maxActiveTasks) {
      setStatus("error");
      setError(`当前已有 ${activeCount} 个任务运行，最多允许 ${maxActiveTasks} 个。请等待完成或取消部分任务。`);
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
              const friendly = getFriendlyErrorMessage(response.error_code, response.error_hint, response.error);
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
              errorHint: "无法从服务器获取状态",
            }));
            if (currentBatchIdRef.current === batchId) {
              setStatus("error");
              setError("无法从服务器获取状态，请稍后重试。");
            }
          }
        }, 500);

        pollTimers.current[task_id] = intervalId;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to start generation";
        if (currentBatchIdRef.current === batchId) {
          setStatus("error");
          setError(message);
        }
        mutateBatchItem(batchId, `failed-${batchId}-${index}`, () => ({
          taskId: `failed-${batchId}-${index}`,
          index,
          status: "error",
          errorHint: message || "无法启动生成任务",
        }));
      }
    };

    try {
      const tasks = Array.from({ length: batchSize }, (_, index) => startSingleTask(index));
      await Promise.all(tasks);
    } finally {
      setIsSubmitting(false);
    }
  }, [authKey, maxActiveTasks, mutateBatchItem, onHistoryUpdated, prompt, settings]);

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
            errorHint: ERROR_HINT_MAP.cancelled,
          };
        });
      });
    } finally {
      setIsCancellingBatch(false);
    }
  }, [authKey, currentBatchItems, currentBatchMeta, mutateBatchItem]);

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

  return {
    prompt,
    setPrompt,
    settings,
    handleSettingsChange,
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
  };
}
