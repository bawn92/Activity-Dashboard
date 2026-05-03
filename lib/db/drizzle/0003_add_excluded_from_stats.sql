ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "excluded_from_stats" boolean NOT NULL DEFAULT false;
