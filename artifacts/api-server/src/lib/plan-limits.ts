import { db, usersTable, travelersTable, favoritePropertiesTable, loyaltyProgramsTable, tripProfilesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export type PlanId = "free" | "pro";

export interface PlanLimits {
  travelers: number;
  favoriteProperties: number;
  loyaltyPrograms: number;
  tripProfiles: number;
}

export const PLANS: Record<PlanId, { id: PlanId; label: string; priceLabel: string; limits: PlanLimits }> = {
  free: {
    id: "free",
    label: "Free",
    priceLabel: "$0",
    limits: {
      travelers: 2,
      favoriteProperties: 5,
      loyaltyPrograms: 5,
      tripProfiles: 1,
    },
  },
  pro: {
    id: "pro",
    label: "Pro",
    priceLabel: "$9 / mo",
    limits: {
      travelers: Infinity,
      favoriteProperties: Infinity,
      loyaltyPrograms: Infinity,
      tripProfiles: Infinity,
    },
  },
};

export type ResourceKey = keyof PlanLimits;

const RESOURCE_LABEL: Record<ResourceKey, string> = {
  travelers: "travelers",
  favoriteProperties: "saved properties",
  loyaltyPrograms: "loyalty programs",
  tripProfiles: "trip profiles",
};

export async function getUserPlan(userId: string): Promise<PlanId> {
  const [row] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  const plan = (row?.plan as PlanId | undefined) ?? "free";
  return plan === "pro" ? "pro" : "free";
}

export async function setUserPlan(userId: string, plan: PlanId): Promise<void> {
  await db
    .insert(usersTable)
    .values({ id: userId, plan })
    .onConflictDoUpdate({ target: usersTable.id, set: { plan, updatedAt: new Date() } });
}

async function countResource(userId: string, resource: ResourceKey): Promise<number> {
  const tableMap = {
    travelers: travelersTable,
    favoriteProperties: favoritePropertiesTable,
    loyaltyPrograms: loyaltyProgramsTable,
    tripProfiles: tripProfilesTable,
  } as const;
  const t = tableMap[resource];
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(t as any)
    .where(eq((t as any).userId, userId));
  return row?.c ?? 0;
}

export async function getUsage(userId: string): Promise<PlanLimits> {
  const [travelers, favoriteProperties, loyaltyPrograms, tripProfiles] = await Promise.all([
    countResource(userId, "travelers"),
    countResource(userId, "favoriteProperties"),
    countResource(userId, "loyaltyPrograms"),
    countResource(userId, "tripProfiles"),
  ]);
  return { travelers, favoriteProperties, loyaltyPrograms, tripProfiles };
}

export interface LimitCheckResult {
  ok: boolean;
  plan: PlanId;
  limit: number;
  current: number;
  resource: ResourceKey;
  resourceLabel: string;
}

export async function checkLimit(userId: string, resource: ResourceKey): Promise<LimitCheckResult> {
  const plan = await getUserPlan(userId);
  const limit = PLANS[plan].limits[resource];
  const current = await countResource(userId, resource);
  return {
    ok: current < limit,
    plan,
    limit: limit === Infinity ? -1 : limit,
    current,
    resource,
    resourceLabel: RESOURCE_LABEL[resource],
  };
}

export function limitExceededResponse(check: LimitCheckResult) {
  return {
    error: "plan_limit_exceeded",
    message: `Your ${PLANS[check.plan].label} plan is limited to ${check.limit} ${check.resourceLabel}. Upgrade to Pro for unlimited.`,
    plan: check.plan,
    resource: check.resource,
    limit: check.limit,
    current: check.current,
  };
}
