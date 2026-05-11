import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { isDevBypassActive } from "@/lib/dev-bypass";

export type AllowedStatus =
  | { state: "loading" }
  | { state: "not_signed_in" }
  | { state: "allowed" }
  | { state: "wrong_email" };

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
}

export function useAllowedStatus(): AllowedStatus {
  const { user, isLoaded } = useUser();
  const bypass = isDevBypassActive();

  const { data, isLoading } = useQuery({
    queryKey: ["auth-allowed", user?.id ?? null],
    queryFn: async () => {
      const res = await fetch(`${apiBase()}/api/auth/allowed`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to check authorization");
      return res.json() as Promise<{ allowed: boolean; reason: string | null }>;
    },
    enabled: isLoaded,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const result = query.state.data;
      if (user && result && !result.allowed && result.reason === "not_signed_in") {
        return 2_000;
      }
      return false;
    },
  });

  if (bypass) return { state: "allowed" };
  if (!isLoaded || isLoading) return { state: "loading" };
  if (!user) return { state: "not_signed_in" };
  if (!data) return { state: "loading" };
  if (data.allowed) return { state: "allowed" };
  if (data.reason === "not_signed_in") return { state: "loading" };
  return { state: "wrong_email" };
}
