import { findPublicPlan, PUBLIC_PLANS, type PublicPlan, type PlanTier } from '#shared/constants/public-plans'

export type Plan = PublicPlan
export type { PlanTier }

export const usePlans = () => {
  // Unknown input resolves to Standard everywhere the funnel does, so one
  // stale value cannot produce two different answers on the same screen.
  const findPlan = (tier: string | null | undefined): Plan => findPublicPlan(tier)

  return { plans: PUBLIC_PLANS, findPlan }
}
