import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const coachThreadsTable = pgTable("coach_threads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("New conversation"),
  titlePending: boolean("title_pending").notNull().default(true),
  isFavourite: boolean("is_favourite").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CoachThread = typeof coachThreadsTable.$inferSelect;
export type InsertCoachThread = typeof coachThreadsTable.$inferInsert;

export const coachMessagesTable = pgTable("coach_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id")
    .notNull()
    .references(() => coachThreadsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CoachMessage = typeof coachMessagesTable.$inferSelect;
export type InsertCoachMessage = typeof coachMessagesTable.$inferInsert;
