import { pgTable, text, timestamp, jsonb, integer, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reviewScoresTable = pgTable(
  "review_scores",
  {
    propertyId: text("property_id").notNull(),
    source: text("source").notNull(),
    reviewHash: text("review_hash").notNull(),
    reviewText: text("review_text").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]),
    luxuryValueScore: integer("luxury_value_score"),
    foodieScore: integer("foodie_score"),
    ecoScore: integer("eco_score"),
    adventurousMenuScore: integer("adventurous_menu_score"),
    rawClaudeResponse: jsonb("raw_claude_response"),
    cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.propertyId, table.source, table.reviewHash] }),
  ]
);

export const insertReviewScoreSchema = createInsertSchema(reviewScoresTable).omit({ cachedAt: true });
export type InsertReviewScore = z.infer<typeof insertReviewScoreSchema>;
export type ReviewScore = typeof reviewScoresTable.$inferSelect;
