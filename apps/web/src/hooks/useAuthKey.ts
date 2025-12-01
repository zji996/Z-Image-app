import { useCallback, useState } from "react";

const AUTH_STORAGE_KEY = "zimage_auth_key";

export function useAuthKey() {
  const [authKey, setAuthKeyState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(AUTH_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const setAuthKey = useCallback((value: string) => {
    setAuthKeyState(value);
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
  }, []);

  return { authKey, setAuthKey };
}

