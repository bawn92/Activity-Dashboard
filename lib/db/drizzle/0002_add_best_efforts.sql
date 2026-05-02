CREATE TABLE IF NOT EXISTS "best_efforts" (
  "id" serial PRIMARY KEY,
  "sport" text NOT NULL,
  "distance_meters" real NOT NULL,
  "label" text NOT NULL,
  "duration_seconds" real,
  "activity_id" integer REFERENCES "activities"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT NOW(),
  CONSTRAINT "best_efforts_sport_distance_unique" UNIQUE ("sport", "distance_meters")
);
