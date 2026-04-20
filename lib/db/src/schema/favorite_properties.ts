import { pgTable, text, serial, timestamp, jsonb, integer } from "drizzle-orm/pg-core";

export const favoritePropertiesTable = pgTable("favorite_properties", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  propertyName: text("property_name").notNull(),
  brand: text("brand"),
  location: text("location"),
  category: text("category"),
  tier: text("tier"),
  tags: jsonb("tags").$type<string[]>().default([]),
  notes: text("notes"),
  visitedAt: text("visited_at"),
  starRating: integer("star_rating"),
  guestScore: text("guest_score"),
  pricePerNight: integer("price_per_night"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FavoriteProperty = typeof favoritePropertiesTable.$inferSelect;
