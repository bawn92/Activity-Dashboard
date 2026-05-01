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
 * `journey` is a path of `[lon, lat]` points starting at `start`, going
 * eastward at the start latitude. Its real-world length equals
 * `totalDistanceMeters`. `goalDistanceMeters` is the full circumnavigation
 * distance at that latitude (back to `start`).
 */
export type GlobeDataResponse = {
  start: { name: string; lat: number; lon: number };
  totalDistanceMeters: number;
  goalDistanceMeters: number;
  journey: [number, number][];
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
