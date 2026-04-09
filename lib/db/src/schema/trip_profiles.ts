import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";

export const tripProfilesTable = pgTable("trip_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  travelerIds: jsonb("traveler_ids").$type<number[]>().default([]),
  emoji: text("emoji").default("✈️"),
  isDefault: text("is_default").default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
