const STORAGE_KEY = "devAuthBypass";
const HEADER_NAME = "x-dev-auth-bypass";

function isDevBuild(): boolean {
  return import.meta.env.DEV === true;
}

export function getDevBypassToken(): string | null {
  if (!isDevBuild()) return null;
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function isDevBypassActive(): boolean {
  return getDevBypassToken() !== null;
}

export function captureDevBypassFromUrl(): void {
  if (!isDevBuild()) return;
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("devbypass");
    if (!token) return;
    window.sessionStorage.setItem(STORAGE_KEY, token);
    url.searchParams.delete("devbypass");
    const cleaned = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
    window.history.replaceState({}, "", cleaned);
  } catch {
    // ignore
  }
}

export function installDevBypassFetch(): void {
  if (!isDevBuild()) return;
  if (typeof window === "undefined") return;
  const w = window as Window & { __devBypassPatched?: boolean };
  if (w.__devBypassPatched) return;
  w.__devBypassPatched = true;

  const origin = window.location.origin;
  const apiBaseRaw = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const apiBase = apiBaseRaw.replace(/\/+$/, "");
  const apiPrefixes = [
    `${origin}/api/`,
    "/api/",
    ...(apiBase ? [`${apiBase}/api/`] : []),
  ];
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getDevBypassToken();
    if (!token) return originalFetch(input, init);

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    const isApi = apiPrefixes.some((p) => url.startsWith(p));
    if (!isApi) return originalFetch(input, init);

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(HEADER_NAME, token);
    return originalFetch(input, { ...init, headers });
  };
}
