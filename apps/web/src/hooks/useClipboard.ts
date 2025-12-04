import { useState, useCallback, useRef, useEffect } from "react";

interface UseClipboardOptions {
  /** Duration in ms before resetting the copied state. Default: 1500 */
  timeout?: number;
}

interface UseClipboardResult {
  /** The ID of the last successfully copied item */
  copiedId: string | null;
  /** Copy text to clipboard with an optional ID for tracking */
  copy: (text: string, id?: string) => Promise<boolean>;
  /** Check if a specific ID was just copied */
  isCopied: (id: string) => boolean;
  /** Reset the copied state */
  reset: () => void;
}

/**
 * Hook for copying text to clipboard with copy state tracking
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardResult {
  const { timeout = 1500 } = options;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string, id?: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
        
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (id) {
          setCopiedId(id);
          timeoutRef.current = setTimeout(() => {
            setCopiedId(null);
          }, timeout);
        }

        return true;
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        return false;
      }
    },
    [timeout]
  );

  const isCopied = useCallback(
    (id: string): boolean => copiedId === id,
    [copiedId]
  );

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setCopiedId(null);
  }, []);

  return {
    copiedId,
    copy,
    isCopied,
    reset,
  };
}

