import {
  pgTable,
  text,
  serial,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { activitiesTable } from "./activities";

export const renderJobsTable = pgTable("render_jobs", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id")
    .notNull()
    .references(() => activitiesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  progress: real("progress").notNull().default(0),
  videoObjectPath: text("video_object_path"),
  errorMessage: text("error_message"),
  // Which composition to render. "cinematic" is the original 12s scene-based
  // video; "map" is an interactive maplibre map render at the user's chosen
  // camera. Defaults to "cinematic" for backwards-compat with existing rows.
  style: text("style").notNull().default("cinematic"),
  // Optional camera params used only when style = "map". Mirror the maplibre
  // camera state captured from the interactive preview.
  centerLat: real("center_lat"),
  centerLng: real("center_lng"),
  zoom: real("zoom"),
  bearing: real("bearing"),
  pitch: real("pitch"),
  // Map-style camera behaviour during the render. "static" keeps the framed
  // camera locked for the whole draw; "follow" pans the camera each frame to
  // keep the moving runner marker centered. Defaults to "static" for
  // backwards-compat with existing rows.
  cameraMode: text("camera_mode").notNull().default("static"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RenderJob = typeof renderJobsTable.$inferSelect;
export type InsertRenderJob = typeof renderJobsTable.$inferInsert;

export type RenderJobStatus = "queued" | "rendering" | "complete" | "failed";
export type RenderJobStyle = "cinematic" | "map";
export type RenderJobCameraMode = "static" | "follow";
