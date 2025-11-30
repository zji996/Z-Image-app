import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { PromptInput } from "./components/PromptInput";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { ResultViewer } from "./components/ResultViewer";
import { HistoryPanel } from "./components/HistoryPanel";
import { HistoryPage } from "./pages/HistoryPage";
import { BatchPreview, type BatchPreviewItem } from "./components/BatchPreview";
import { ApiError, cancelTask, generateImage, getTaskStatus, getHistory, getImageUrl } from "./api/client";
import type { TaskSummary } from "./api/types";

const AUTH_STORAGE_KEY = "zimage_auth_key";
type ViewMode = "studio" | "history";
type HistoryError = "unauthorized" | "unknown" | null;
type LoadHistoryOptions = {
  reset?: boolean;
  clearBeforeFetch?: boolean;
};
const HISTORY_PAGE_SIZE = 24;
const MAX_ACTIVE_TASKS = 8;

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

function App() {
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<{
    width: number;
    height: number;
    steps: number;
    guidance: number;
    seed: number | null;
    images: number;
  }>({
    width: 1024,
    height: 1024,
    steps: 8, // Default for Turbo
    guidance: 0.0, // Default for Turbo
    seed: null,
    images: 1,
  });

  const [status, setStatus] = useState<"idle" | "pending" | "generating" | "success" | "error">("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lastSize, setLastSize] = useState<{ width: number; height: number } | null>({
    width: 1024,
    height: 1024,
  });
  const [error, setError] = useState<string | undefined>();
  const [generationTime, setGenerationTime] = useState<number | undefined>();
  const [authKey, setAuthKey] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(AUTH_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [historyItems, setHistoryItems] = useState<TaskSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<HistoryError>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [activeView, setActiveView] = useState<ViewMode>("studio");
  const [currentBatchMeta, setCurrentBatchMeta] = useState<{ id: string; size: number } | null>(null);
  const [currentBatchItems, setCurrentBatchItems] = useState<BatchPreviewItem[]>([]);
  const [isCancellingBatch, setIsCancellingBatch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"controls" | "result">("controls");

  const pollTimers = useRef<Record<string, number>>({});
  const currentBatchIdRef = useRef<string | null>(null);
  const historyOffsetRef = useRef(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSettingsChange = (key: string, value: number | null) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleAuthKeyChange = (value: string) => {
    setAuthKey(value);
    if (typeof window !== "undefined") {
      try {
        if (value) {
          window.localStorage.setItem(AUTH_STORAGE_KEY, value);
        } else {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors in non-browser environments.
      }
    }
  };

  const loadHistory = useCallback(
    async ({ reset = false, clearBeforeFetch = false }: LoadHistoryOptions = {}) => {
      if (reset) {
        historyOffsetRef.current = 0;
        if (clearBeforeFetch) {
          setHistoryItems([]);
        }
        setHasMoreHistory(true);
      }

      setHistoryError(null);
      setIsHistoryLoading(true);

      try {
        const offset = reset ? 0 : historyOffsetRef.current;
        const items = await getHistory(authKey || undefined, HISTORY_PAGE_SIZE, offset);

        setHistoryItems((prev) => (reset ? items : [...prev, ...items]));
        historyOffsetRef.current = offset + items.length;
        setHasMoreHistory(items.length === HISTORY_PAGE_SIZE);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setHistoryError("unauthorized");
          setHistoryItems([]);
          historyOffsetRef.current = 0;
          setHasMoreHistory(false);
        } else {
          console.error("Failed to fetch history", err);
          setHistoryError("unknown");
        }
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [authKey],
  );

  const refreshHistory = useCallback(
    (clearBeforeFetch = false) => {
      void loadHistory({ reset: true, clearBeforeFetch });
    },
    [loadHistory],
  );

  const loadMoreHistory = useCallback(() => {
    if (isHistoryLoading || !hasMoreHistory) {
      return;
    }
    void loadHistory();
  }, [isHistoryLoading, hasMoreHistory, loadHistory]);

  useEffect(() => {
    refreshHistory(true);
  }, [authKey, refreshHistory]);

  useEffect(() => {
    if (activeView === "history") {
      refreshHistory();
    }
  }, [activeView, refreshHistory]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    updateMatch();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
      return () => mediaQuery.removeEventListener("change", updateMatch);
    }
    mediaQuery.addListener(updateMatch);
    return () => mediaQuery.removeListener(updateMatch);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobilePanel("controls");
      return;
    }
    if (status === "generating" || status === "success") {
      setMobilePanel("result");
    } else {
      setMobilePanel("controls");
    }
  }, [isMobile, status]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    const batchSize = Math.max(1, settings.images || 1);
    const activeCount = Object.keys(pollTimers.current).length;
    if (activeCount + batchSize > MAX_ACTIVE_TASKS) {
      setStatus("error");
      setError(`当前已有 ${activeCount} 个任务运行，最多允许 ${MAX_ACTIVE_TASKS} 个。请等待完成或取消部分任务。`);
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
      const seed =
        settings.seed === null || settings.seed === undefined ? null : settings.seed + index;

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
          authKey || undefined,
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
            const response = await getTaskStatus(task_id, authKey || undefined);

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
              refreshHistory();
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
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach((id) => clearInterval(id));
      pollTimers.current = {};
    };
  }, []);

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
          cancelTask(item.taskId, authKey || undefined).catch((err) => {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      <Header
        authKey={authKey}
        onAuthKeyChange={handleAuthKeyChange}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      <main className="p-4 lg:p-8 overflow-y-auto h-[calc(100vh-73px)]">
        <div className="max-w-6xl mx-auto">
          {activeView === "studio" ? (
            <div className={isMobile ? "space-y-4" : "grid grid-cols-1 lg:grid-cols-2 gap-8"}>
              {isMobile && (
                <div className="grid grid-cols-2 gap-2">
                  {(["controls", "result"] as const).map((panel) => (
                    <button
                      key={panel}
                      type="button"
                      onClick={() => setMobilePanel(panel)}
                      className={`py-2 text-sm font-medium rounded-xl border ${
                        mobilePanel === panel
                          ? "border-cyan-500 text-cyan-100 bg-cyan-500/10"
                          : "border-slate-700 text-slate-300 bg-slate-900"
                      }`}
                    >
                      {panel === "controls" ? "创作" : "结果"}
                    </button>
                  ))}
                </div>
              )}

              {(!isMobile || mobilePanel === "controls") && (
                <div className="space-y-6 order-2 lg:order-1">
                  <PromptInput
                    prompt={prompt}
                    setPrompt={setPrompt}
                    onGenerate={handleGenerate}
                    isGenerating={isSubmitting}
                  />

                  <AdvancedSettings settings={settings} onChange={handleSettingsChange} />

                  <div className="pt-4 text-xs text-slate-600 leading-relaxed">
                    <p className="mb-2 font-semibold text-slate-500">Tips</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Short, descriptive prompts work best.</li>
                      <li>Try adding details like lighting, style, camera, etc.</li>
                      <li>Supports bilingual (English & Chinese) prompts.</li>
                    </ul>
                  </div>

                  <HistoryPanel
                    items={historyItems}
                    isLoading={isHistoryLoading}
                    error={historyError}
                    onSelectImage={(url) => {
                      setImageUrl(url);
                      setStatus("success");
                      if (isMobile) {
                        setMobilePanel("result");
                      }
                    }}
                  />
                </div>
              )}

              {(!isMobile || mobilePanel === "result") && (
                <div className="order-1 lg:order-2 min-h-[45vh]">
                  <ResultViewer
                    status={status}
                    imageUrl={imageUrl}
                    error={error}
                    generationTime={generationTime}
                    width={lastSize?.width}
                    height={lastSize?.height}
                  />
                  <BatchPreview
                    batchId={currentBatchMeta?.id}
                    total={currentBatchMeta?.size ?? 0}
                    items={currentBatchItems}
                    onSelectImage={(url, size) => {
                      setImageUrl(url);
                      if (size) {
                        setLastSize(size);
                      }
                      setStatus("success");
                    }}
                    onCancel={handleCancelBatch}
                    isCancelling={isCancellingBatch}
                  />
                </div>
              )}
            </div>
          ) : (
            <HistoryPage
              items={historyItems}
              isLoading={isHistoryLoading}
              error={historyError}
              canLoadMore={hasMoreHistory && historyItems.length > 0}
              onRefresh={refreshHistory}
              onLoadMore={loadMoreHistory}
              onSelectImage={(url, size) => {
                setImageUrl(url);
                if (size) {
                  setLastSize(size);
                }
                setStatus("success");
                setActiveView("studio");
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
