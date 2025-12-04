import { useCallback, useEffect, useRef } from "react";
import { cancelTask, generateImage, getBatchDetail, getImageUrl } from "../api/client";
import type { BatchItem, BatchItemDetail, ImageSelectionInfo } from "../api/types";
import { useI18n } from "../i18n";
import { useGenerationStore, type GenerationSettings, type BatchMeta } from "../store/generationStore";

export type { GenerationSettings, BatchMeta };

export interface UseImageGenerationOptions {
  authKey: string;
  maxActiveTasks?: number;
  onHistoryUpdated?: () => void;
}

const DEFAULT_MAX_ACTIVE_TASKS = 8;

/** 将后端 BatchItemDetail 转换为前端 BatchItem */
const toBatchItem = (item: BatchItemDetail): BatchItem => ({
  taskId: item.task_id,
  index: item.index,
  status: item.status,
  imageUrl: item.image_url ? getImageUrl(item.image_url) : undefined,
  width: item.width,
  height: item.height,
  seed: item.seed,
  errorCode: item.error_code,
  errorHint: item.error_hint,
  progress: item.progress ?? undefined,
});

export function useImageGeneration(options: UseImageGenerationOptions) {
  const { authKey, maxActiveTasks = DEFAULT_MAX_ACTIVE_TASKS, onHistoryUpdated } = options;
  const { t } = useI18n();

  // Use global store
  const {
    prompt,
    settings,
    setPrompt,
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
    setStatus,
    setImageUrl,
    setError,
    setGenerationTime,
    setLastSize,
    setIsSubmitting,
    setCurrentBatchMeta,
    setCurrentBatchItems,
    setIsCancellingBatch,
    initBatch,
  } = useGenerationStore();

  const batchPollTimer = useRef<number | null>(null);
  const currentBatchIdRef = useRef<string | null>(null);
  const generationStartTimeRef = useRef<number>(0);

  const clearBatchPoll = useCallback(() => {
    if (batchPollTimer.current) {
      clearInterval(batchPollTimer.current);
      batchPollTimer.current = null;
    }
  }, []);

  const setSingleImageState = useCallback(
    (params: {
      imageUrl: string;
      width?: number;
      height?: number;
      seed?: number | null;
      batchId?: string;
      taskId?: string;
      batchSize?: number;
      successCount?: number;
      failedCount?: number;
    }) => {
      const {
        imageUrl,
        width,
        height,
        seed,
        batchId,
        taskId,
        batchSize,
        successCount,
        failedCount,
      } = params;

      clearBatchPoll();

      const effectiveBatchId = batchId ?? `preview-${Date.now()}`;
      currentBatchIdRef.current = effectiveBatchId;

      setImageUrl(imageUrl);
      setStatus("success");
      setError(undefined);

      setCurrentBatchMeta({
        id: effectiveBatchId,
        size: batchSize ?? 1,
        ...(typeof successCount === "number" ? { completed: successCount } : {}),
        ...(typeof failedCount === "number" ? { failed: failedCount } : {}),
      });

      setCurrentBatchItems([
        {
          taskId: taskId ?? effectiveBatchId,
          index: 0,
          status: "success",
          imageUrl,
          width,
          height,
          seed,
        },
      ]);
      setIsCancellingBatch(false);

      if (width && height) {
        setLastSize({ width, height });
      }
    },
    [clearBatchPoll, setCurrentBatchItems, setCurrentBatchMeta, setError, setImageUrl, setIsCancellingBatch, setLastSize, setStatus]
  );

  /** 开始轮询批次状态 */
  const startBatchPolling = useCallback(
    (batchId: string, batchSize: number) => {
      clearBatchPoll();

      const poll = async () => {
        if (currentBatchIdRef.current !== batchId) {
          clearBatchPoll();
          return;
        }

        try {
          const detail = await getBatchDetail(batchId, authKey || "admin");
          const items = detail.items.map(toBatchItem).sort((a, b) => a.index - b.index);

          // 更新批次项目
          setCurrentBatchItems(items);

          // 找到第一张成功的图片作为主预览
          const firstSuccess = items.find((item) => item.status === "success" && item.imageUrl);
          if (firstSuccess?.imageUrl) {
            setImageUrl(firstSuccess.imageUrl);
            if (firstSuccess.width && firstSuccess.height) {
              setLastSize({ width: firstSuccess.width, height: firstSuccess.height });
            }
          }

          // 计算完成状态
          const successCount = items.filter((item) => item.status === "success").length;
          const failedCount = items.filter(
            (item) => item.status === "error" || item.status === "cancelled"
          ).length;
          const finishedCount = successCount + failedCount;

          // 如果所有任务都完成了
          if (finishedCount >= batchSize) {
            clearBatchPoll();
            const endTime = performance.now();
            setGenerationTime((endTime - generationStartTimeRef.current) / 1000);

            if (successCount > 0) {
              setStatus("success");
            } else {
              setStatus("error");
              const firstError = items.find((item) => item.status === "error");
              if (firstError?.errorHint) {
                setError(firstError.errorHint);
              }
            }

            if (onHistoryUpdated) {
              onHistoryUpdated();
            }
          } else {
            // 还有任务在进行中
            setStatus("generating");
          }
        } catch (err) {
          console.error("Batch polling error:", err);
          // 不要因为单次轮询失败就停止，继续重试
        }
      };

      // 立即执行一次，然后每 800ms 轮询
      void poll();
      batchPollTimer.current = window.setInterval(poll, 800);
    },
    [authKey, clearBatchPoll, onHistoryUpdated, setCurrentBatchItems, setError, setGenerationTime, setImageUrl, setLastSize, setStatus]
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const batchSize = Math.max(1, settings.images || 1);

    // 检查是否超过最大并发数
    if (batchSize > maxActiveTasks) {
      setStatus("error");
      setError(t("errors.tooManyTasks", { active: 0, max: maxActiveTasks }));
      return;
    }

    // 生成 batch ID
    const batchId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : (() => {
            const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
            let uuid = "";
            for (const ch of template) {
              if (ch === "x" || ch === "y") {
                const randomValue = (Math.random() * 16) | 0;
                const value = ch === "x" ? randomValue : (randomValue & 0x3) | 0x8;
                uuid += value.toString(16);
              } else {
                uuid += ch;
              }
            }
            return uuid;
          })();

    // 停止之前的轮询
    clearBatchPoll();

    // 初始化状态
    currentBatchIdRef.current = batchId;
    generationStartTimeRef.current = performance.now();
    initBatch(batchId, batchSize, settings.width, settings.height);

    try {
      // 串行发送所有生成请求，确保按顺序入队
      for (let index = 0; index < batchSize; index++) {
        const seed =
          settings.seed === null || settings.seed === undefined ? null : settings.seed + index;

        await generateImage(
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
          authKey || "admin"
        );
      }

      // 所有请求发送完毕后，开始轮询批次状态
      setStatus("generating");
      startBatchPolling(batchId, batchSize);
    } catch (err: unknown) {
      const fallbackMessage = t("errors.failedToStart");
      const message = err instanceof Error && err.message ? err.message : fallbackMessage;
      setStatus("error");
      setError(message || fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    authKey,
    clearBatchPoll,
    initBatch,
    maxActiveTasks,
    prompt,
    setError,
    setIsSubmitting,
    setStatus,
    settings,
    startBatchPolling,
    t,
  ]);

  const handleCancelBatch = useCallback(async () => {
    if (!currentBatchMeta) {
      return;
    }

    const cancellableTasks = currentBatchItems.filter(
      (item) => item.status === "pending" || item.status === "running"
    );
    if (cancellableTasks.length === 0) {
      return;
    }

    setIsCancellingBatch(true);
    try {
      await Promise.all(
        cancellableTasks.map((item) =>
          cancelTask(item.taskId, authKey || "admin").catch((err) => {
            console.error("Failed to cancel task", err);
          })
        )
      );

      // 更新本地状态
      setCurrentBatchItems((prev) =>
        prev.map((item) =>
          cancellableTasks.some((c) => c.taskId === item.taskId)
            ? { ...item, status: "cancelled" as const, errorHint: t("errors.cancelled") }
            : item
        )
      );
    } finally {
      setIsCancellingBatch(false);
    }
  }, [authKey, currentBatchItems, currentBatchMeta, setCurrentBatchItems, setIsCancellingBatch, t]);

  // 清理轮询
  useEffect(() => {
    return () => {
      clearBatchPoll();
    };
  }, [clearBatchPoll]);

  const selectImage = useCallback(
    (url: string, size?: { width: number; height: number }, options?: { keepBatchState?: boolean }) => {
      // 如果是同一张图片，跳过更新避免不必要的重新渲染和图片重新加载
      if (url === imageUrl) {
        return;
      }

      const { keepBatchState = false } = options ?? {};

      // 如果正在生成或明确要保持 batch 状态，只更新主预览图片
      if (status === "generating" || status === "pending" || keepBatchState) {
        setImageUrl(url);
        if (size) {
          setLastSize(size);
        }
      } else {
        setSingleImageState({
          imageUrl: url,
          width: size?.width,
          height: size?.height,
        });
      }
    },
    [imageUrl, setImageUrl, setLastSize, setSingleImageState, status]
  );

  /** 从历史记录加载完整批次到 Studio */
  const loadFromHistory = useCallback(
    (info: ImageSelectionInfo) => {
      // 如果没有 batchId，就退化为单张预览
      if (!info.batchId) {
        setSingleImageState({
          imageUrl: info.imageUrl,
          width: info.width,
          height: info.height,
          seed: info.seed,
        });
      } else {
        const batchSize = info.batchSize && info.batchSize > 0 ? info.batchSize : 1;

        // 准备状态
        clearBatchPoll();
        currentBatchIdRef.current = info.batchId;

        setCurrentBatchMeta({ id: info.batchId, size: batchSize });
        setCurrentBatchItems(
          Array.from({ length: batchSize }, (_, i) => ({
            taskId: `history-${info.batchId}-${i}`,
            index: i,
            status: "pending" as const,
          }))
        );
        setIsCancellingBatch(false);
        setStatus("pending");
        setError(undefined);
        setImageUrl(null);
        setGenerationTime(undefined);
        if (info.width && info.height) {
          setLastSize({ width: info.width, height: info.height });
        }

        // 启动一次批次轮询，从后端加载该 batch 的所有图片
        startBatchPolling(info.batchId, batchSize);
      }

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
        updateSettings(updates);
      }

      if (info.width && info.height) {
        setLastSize({ width: info.width, height: info.height });
      }
    },
    [
      clearBatchPoll,
      setCurrentBatchItems,
      setCurrentBatchMeta,
      setError,
      setGenerationTime,
      setImageUrl,
      setIsCancellingBatch,
      setLastSize,
      setPrompt,
      setStatus,
      setSingleImageState,
      startBatchPolling,
      updateSettings,
    ]
  );

  return {
    // State (from store)
    prompt,
    settings,
    status,
    imageUrl,
    error,
    generationTime,
    lastSize,
    isSubmitting,
    currentBatchMeta,
    currentBatchItems,
    isCancellingBatch,
    // Actions
    setPrompt,
    updateSettings,
    handleGenerate,
    handleCancelBatch,
    selectImage,
    loadFromHistory,
  };
}
