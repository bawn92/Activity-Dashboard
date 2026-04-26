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
