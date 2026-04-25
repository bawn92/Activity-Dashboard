import {
  pgTable,
  text,
  serial,
  timestamp,
  real,
  integer,
  foreignKey,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  sport: text("sport").notNull().default("unknown"),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  durationSeconds: real("duration_seconds"),
  distanceMeters: real("distance_meters"),
  avgSpeedMps: real("avg_speed_mps"),
  avgPaceSecPerKm: real("avg_pace_sec_per_km"),
  totalElevGainMeters: real("total_elev_gain_meters"),
  totalElevDescMeters: real("total_elev_desc_meters"),
  maxSpeedMps: real("max_speed_mps"),
  avgHeartRate: real("avg_heart_rate"),
  maxHeartRate: real("max_heart_rate"),
  totalCalories: real("total_calories"),
  avgCadence: real("avg_cadence"),
  avgPower: real("avg_power"),
  normalizedPower: real("normalized_power"),
  avgVerticalOscillationMm: real("avg_vertical_oscillation_mm"),
  avgStanceTimeMs: real("avg_stance_time_ms"),
  avgVerticalRatio: real("avg_vertical_ratio"),
  avgStepLengthMm: real("avg_step_length_mm"),
  fileObjectPath: text("file_object_path"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;

export const activityDataPointsTable = pgTable("activity_data_points", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id")
    .notNull()
    .references(() => activitiesTable.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  heartRate: real("heart_rate"),
  cadence: real("cadence"),
  altitude: real("altitude"),
  lat: real("lat"),
  lng: real("lng"),
  speed: real("speed"),
  distance: real("distance"),
  power: real("power"),
});

export const insertActivityDataPointSchema = createInsertSchema(
  activityDataPointsTable,
).omit({ id: true });
export type InsertActivityDataPoint = z.infer<
  typeof insertActivityDataPointSchema
>;
export type ActivityDataPoint = typeof activityDataPointsTable.$inferSelect;
