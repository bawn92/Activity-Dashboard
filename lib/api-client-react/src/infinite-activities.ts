import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import {
  listActivities,
  getListActivitiesQueryKey,
} from "./generated/api";
import type { ActivitySummary } from "./generated/api.schemas";

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
      const data = await listActivities({ signal });
      return { data, nextOffset: null };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
}
