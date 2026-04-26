// Re-export the zod schemas (request/response validators) from `./generated/api`.
export * from "./generated/api";
// Re-export the generated TypeScript types. We hide any name that collides
// with a zod schema export above (e.g. `CreateRenderJobBody` exists as both a
// zod schema and a type) — the schema's inferred type is the source of truth.
export type {
  ActivityDetail,
  ActivityStats,
  ActivitySummary,
  CreateRenderJobBodyStyle,
  DataPoint,
  ErrorResponse,
  HealthStatus,
  RenderJob,
  RenderJobStatus,
  RenderJobStyle,
  SportCount,
  StorageUploadPresignedUrl,
  StorageUploadRequestBody,
} from "./generated/types";
