import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface PlanLimitsValues {
  travelers: number;
  favoriteProperties: number;
  loyaltyPrograms: number;
  tripProfiles: number;
}

export interface PlanDef {
  id: "free" | "pro";
  label: string;
  priceLabel: string;
  limits: PlanLimitsValues;
}

export interface PlanResponse {
  plan: "free" | "pro";
  label: string;
  limits: PlanLimitsValues;
  usage: PlanLimitsValues;
  plans: PlanDef[];
}

export const PLAN_QUERY_KEY = ["plan"] as const;

export function usePlan() {
  return useQuery<PlanResponse>({
    queryKey: PLAN_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/plan", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load plan");
      return res.json();
    },
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: "free" | "pro") => {
      const res = await fetch("/api/plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error("Failed to change plan");
      return res.json() as Promise<{ plan: "free" | "pro" }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLAN_QUERY_KEY }),
  });
}

export function formatLimit(n: number): string {
  return n < 0 ? "Unlimited" : String(n);
}

export function isAtLimit(plan: PlanResponse | undefined, resource: keyof PlanLimitsValues): boolean {
  if (!plan) return false;
  const limit = plan.limits[resource];
  if (limit < 0) return false;
  return plan.usage[resource] >= limit;
}
