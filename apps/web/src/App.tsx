import { useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { PromptInput } from "./components/PromptInput";
import { AdvancedSettings } from "./components/AdvancedSettings";
import { ResultViewer } from "./components/ResultViewer";
import { HistoryPanel } from "./components/HistoryPanel";
import { generateImage, getTaskStatus, getHistory, getImageUrl } from "./api/client";
import type { TaskSummary } from "./api/types";

const AUTH_STORAGE_KEY = "zimage_auth_key";

function App() {
  const [prompt, setPrompt] = useState("");
  const [settings, setSettings] = useState<{
    width: number;
    height: number;
    steps: number;
    guidance: number;
    seed: number | null;
  }>({
    width: 1024,
    height: 1024,
    steps: 8, // Default for Turbo
    guidance: 0.0, // Default for Turbo
    seed: null,
  });

  const [status, setStatus] = useState<"idle" | "pending" | "generating" | "success" | "error">("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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

  const pollTimer = useRef<number | null>(null);

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

  const refreshHistory = async () => {
    if (!authKey) {
      setHistoryItems([]);
      return;
    }
    try {
      setIsHistoryLoading(true);
      const items = await getHistory(authKey, 24);
      setHistoryItems(items);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    // Refresh history whenever auth key changes.
    void refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authKey]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus("generating");
    setError(undefined);
    setImageUrl(null);
    const startTime = performance.now();

    try {
      const { task_id } = await generateImage(
        {
          prompt,
          height: settings.height,
          width: settings.width,
          num_inference_steps: settings.steps,
          guidance_scale: settings.guidance,
          seed: settings.seed,
        },
        authKey || undefined,
      );

      // Start polling
      pollTimer.current = window.setInterval(async () => {
        try {
          const response = await getTaskStatus(task_id, authKey || undefined);

          if (response.status === "SUCCESS" && response.result) {
            if (pollTimer.current) clearInterval(pollTimer.current);
            const endTime = performance.now();
            setGenerationTime((endTime - startTime) / 1000);
            setImageUrl(getImageUrl(response.result.relative_path));
            setStatus("success");
            void refreshHistory();
          } else if (response.status === "FAILURE" || response.status === "REVOKED") {
            if (pollTimer.current) clearInterval(pollTimer.current);
            setStatus("error");
            setError(response.error || "Task failed");
          }
          // If PENDING or STARTED, continue polling
        } catch (err) {
          console.error("Polling error:", err);
          // Don't stop polling on transient network errors, maybe? 
          // For now, let's stop to avoid infinite loops if backend is down
          if (pollTimer.current) clearInterval(pollTimer.current);
          setStatus("error");
          setError("Failed to get status from server");
        }
      }, 500);

    } catch (err: any) {
      setStatus("error");
      setError(err.message || "Failed to start generation");
    }
  };

  // Cleanup on unmount
  // useEffect(() => {
  //   return () => {
  //     if (pollTimer.current) clearInterval(pollTimer.current);
  //   };
  // }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      <Header authKey={authKey} onAuthKeyChange={handleAuthKeyChange} />

      <main className="p-4 lg:p-8 overflow-y-auto h-[calc(100vh-73px)]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Controls */}
          <div className="space-y-6 order-2 lg:order-1">
            <PromptInput
              prompt={prompt}
              setPrompt={setPrompt}
              onGenerate={handleGenerate}
              isGenerating={status === "generating" || status === "pending"}
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
              onSelectImage={(url) => {
                setImageUrl(url);
                setStatus("success");
              }}
              hasAuthKey={Boolean(authKey)}
            />
          </div>

          {/* Right Column: Result */}
          <div className="order-1 lg:order-2 min-h-[50vh]">
            <ResultViewer
              status={status}
              imageUrl={imageUrl}
              error={error}
              generationTime={generationTime}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
