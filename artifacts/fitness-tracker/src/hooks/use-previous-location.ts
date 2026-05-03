import { useEffect } from "react";
import { useLocation } from "wouter";

const STORAGE_KEY = "evolvelog:previous-location";

const LIST_ROUTE_LABELS: Array<{ match: (path: string) => boolean; href: string; label: string }> = [
  { match: (p) => p === "/table", href: "/table", label: "Back to table" },
  { match: (p) => p === "/stats" || p.startsWith("/stats/"), href: "/stats", label: "Back to stats" },
  { match: (p) => p === "/activities", href: "/activities", label: "Back to activities" },
  { match: (p) => p === "/calendar", href: "/calendar", label: "Back to calendar" },
  { match: (p) => p === "/globe", href: "/globe", label: "Back to globe" },
  { match: (p) => p === "/agent" || p === "/", href: "/agent", label: "Back to coach" },
];

function isTrackable(path: string): boolean {
  return LIST_ROUTE_LABELS.some((r) => r.match(path));
}

export function usePreviousLocationTracker(): null {
  const [location] = useLocation();

  useEffect(() => {
    if (isTrackable(location)) {
      try {
        sessionStorage.setItem(STORAGE_KEY, location);
      } catch {
      }
    }
  }, [location]);

  return null;
}

export function getBackTarget(fallbackHref = "/activities", fallbackLabel = "Back to activities"): { href: string; label: string } {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const match = LIST_ROUTE_LABELS.find((r) => r.match(stored));
      if (match) return { href: match.href, label: match.label };
    }
  } catch {
  }
  return { href: fallbackHref, label: fallbackLabel };
}
