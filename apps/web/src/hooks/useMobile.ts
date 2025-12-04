import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = "(max-width: 1023px)";

/**
 * Hook to detect mobile viewport
 * Uses matchMedia API with fallback for older browsers
 */
export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT);
    const updateMatch = () => setIsMobile(mediaQuery.matches);
    
    // Initial check
    updateMatch();

    // Modern browsers
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateMatch);
    } else if (typeof mediaQuery.addListener === "function") {
      // Legacy browsers (Safari < 14)
      mediaQuery.addListener(updateMatch);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", updateMatch);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(updateMatch);
      }
    };
  }, []);

  return isMobile;
}

