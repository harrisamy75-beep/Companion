import { pgTable, text, serial, date, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const travelersTable = pgTable("travelers", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  birthDate: date("birth_date"),
  travelerType: text("traveler_type").notNull().default("adult"),
  relationship: text("relationship"),
  foodPreferences: jsonb("food_preferences").$type<string[]>().default([]),
  activityPreferences: jsonb("activity_preferences").$type<string[]>().default([]),
  accessibilityNeeds: text("accessibility_needs"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTravelerSchema = createInsertSchema(travelersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTraveler = z.infer<typeof insertTravelerSchema>;
export type Traveler = typeof travelersTable.$inferSelect;
