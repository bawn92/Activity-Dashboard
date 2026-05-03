import { useQuery, useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import { getListActivitiesQueryKey } from "./generated/api";
import type { ActivitySummary } from "./generated/api.schemas";

type ListActivitiesResponse =
  | ActivitySummary[]
  | { data: ActivitySummary[]; total?: number };

async function fetchActivitiesFlat(signal?: AbortSignal): Promise<ActivitySummary[]> {
  const raw = await customFetch<ListActivitiesResponse>("/api/activities", {
    method: "GET",
    signal,
  });
  if (Array.isArray(raw)) return raw;
  return raw?.data ?? [];
}

export type ActivitiesPage = {
  data: ActivitySummary[];
  nextOffset: number | null;
};

export function useInfiniteListActivities() {
  return useInfiniteQuery<
    ActivitiesPage,
    Error,
    InfiniteData<ActivitiesPage>,
    readonly unknown[],
    number
  >({
    queryKey: [...getListActivitiesQueryKey(), "infinite"] as const,
    initialPageParam: 0,
    queryFn: async ({ signal }) => {
      const data = await fetchActivitiesFlat(signal);
      return { data, nextOffset: null };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}

export function useListAllActivities() {
  return useQuery<ActivitySummary[]>({
    queryKey: [...getListActivitiesQueryKey(), "flat"] as const,
    queryFn: ({ signal }) => fetchActivitiesFlat(signal),
  });
}
