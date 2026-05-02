CREATE TABLE IF NOT EXISTS "coach_threads" (
        "id" serial PRIMARY KEY NOT NULL,
        "title" text DEFAULT 'New conversation' NOT NULL,
        "title_pending" boolean DEFAULT true NOT NULL,
        "is_favourite" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "thread_id" integer NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_thread_id_coach_threads_id_fk"
   FOREIGN KEY ("thread_id") REFERENCES "public"."coach_threads"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
