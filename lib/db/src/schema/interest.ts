import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const interestSignupsTable = pgTable(
  "interest_signups",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("interest_signups_email_unique").on(table.email),
  }),
);

export type InterestSignup = typeof interestSignupsTable.$inferSelect;
export type InsertInterestSignup = typeof interestSignupsTable.$inferInsert;
