import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const preferencesTable = pgTable("travel_preferences", {
  id: serial("id").primaryKey(),
  seatPreference: text("seat_preference"),
  mealPreference: text("meal_preference"),
  frequentFlyerNumbers: text("frequent_flyer_numbers"),
  passportNotes: text("passport_notes"),
  accessibilityNeeds: text("accessibility_needs"),
  hotelPreferences: text("hotel_preferences"),
  travelInsuranceNotes: text("travel_insurance_notes"),
  additionalNotes: text("additional_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPreferencesSchema = createInsertSchema(preferencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;
export type Preferences = typeof preferencesTable.$inferSelect;
