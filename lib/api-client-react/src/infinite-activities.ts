import { useQuery, useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import { getListActivitiesQueryKey } from "./generated/api";
import type { ActivitySummary } from "./generated/api.schemas";

type ListActivitiesResponse =
  | ActivitySummary[]
  | { data: ActivitySummary[]; total?: number };

const SERVER_PAGE_SIZE = 500;

async function fetchActivitiesFlat(signal?: AbortSignal): Promise<ActivitySummary[]> {
  const all: ActivitySummary[] = [];
  let offset = 0;
  let total: number | undefined;
  while (true) {
    const raw = await customFetch<ListActivitiesResponse>(
      `/api/activities?limit=${SERVER_PAGE_SIZE}&offset=${offset}`,
      { method: "GET", signal },
    );
    let pageData: ActivitySummary[];
    if (Array.isArray(raw)) {
      pageData = raw;
    } else {
      pageData = raw?.data ?? [];
      if (typeof raw?.total === "number") total = raw.total;
    }
    all.push(...pageData);
    if (pageData.length < SERVER_PAGE_SIZE) break;
    if (total !== undefined && all.length >= total) break;
    offset += SERVER_PAGE_SIZE;
  }
  return all;
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
