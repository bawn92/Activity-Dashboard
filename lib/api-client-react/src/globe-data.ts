import { useQuery } from "@tanstack/react-query";
import type {
  QueryFunction,
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";

import { customFetch } from "./custom-fetch";
import type { ErrorType } from "./custom-fetch";

type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];

/**
 * `GET /api/globe/data` — "around the world from Galway" journey.
 *
 * The journey goes east along the equator starting at Galway's longitude.
 * `activities` are in chronological order so the frontend can colour each
 * segment by sport. `goalDistanceMeters` is the full equatorial circumference.
 */
export type GlobeActivitySegment = {
  sport: string;
  distanceMeters: number;
};

export type GlobeDataResponse = {
  start: { name: string; lat: number; lon: number };
  totalDistanceMeters: number;
  goalDistanceMeters: number;
  activities: GlobeActivitySegment[];
};

export const getGlobeDataUrl = () => {
  return `/api/globe/data`;
};

export const getGlobeData = async (
  options?: RequestInit,
): Promise<GlobeDataResponse> => {
  return customFetch<GlobeDataResponse>(getGlobeDataUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGlobeDataQueryKey = () => {
  return [`/api/globe/data`] as const;
};

export const getGlobeDataQueryOptions = <
  TData = Awaited<ReturnType<typeof getGlobeData>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<
    Awaited<ReturnType<typeof getGlobeData>>,
    TError,
    TData
  >;
  request?: SecondParameter<typeof customFetch>;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};

  const queryKey = queryOptions?.queryKey ?? getGlobeDataQueryKey();

  const queryFn: QueryFunction<Awaited<ReturnType<typeof getGlobeData>>> = ({
    signal,
  }) => getGlobeData({ signal, ...requestOptions });

  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getGlobeData>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGlobeData<
  TData = Awaited<ReturnType<typeof getGlobeData>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: UseQueryOptions<
    Awaited<ReturnType<typeof getGlobeData>>,
    TError,
    TData
  >;
  request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGlobeDataQueryOptions(options);

  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };

  return { ...query, queryKey: queryOptions.queryKey };
}
