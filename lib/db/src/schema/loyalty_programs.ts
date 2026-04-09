import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const loyaltyProgramsTable = pgTable("loyalty_programs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  programName: text("program_name").notNull(),
  brand: text("brand").notNull(),
  membershipNumber: text("membership_number"),
  tier: text("tier"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoyaltyProgram = typeof loyaltyProgramsTable.$inferSelect;
