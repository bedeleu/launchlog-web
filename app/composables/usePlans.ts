export type PlanTier = 'basic' | 'featured'

export interface Plan {
  tier: PlanTier
  name: string
  /** Annual price, e.g. "$24.99". */
  priceLabel: string
  /** Monthly equivalent, e.g. "$2.08". */
  monthlyLabel: string
  features: string[]
  /** Short factual badge, e.g. "Promoted placement". */
  badge?: string
  /** The promoted tier. */
  highlight?: boolean
}

// Two plans (locked 2026-08-17): Standard is the sensible listing product,
// Featured is the promoted product. Internal identifier for Standard stays
// `basic`; only the display name changes. No crossed-out anchor prices and no
// artificial urgency — copy states eligibility and daily re-seeding, never
// guaranteed exposure.
const PLANS: Plan[] = [
  {
    tier: 'basic',
    name: 'Standard',
    priceLabel: '$24.99',
    monthlyLabel: '$2.08',
    features: [
      'Standard listing card in the directory',
      'Real website screenshot',
      'Dedicated listing page with a direct link to your site',
      'schema.org structured data, Markdown and llms.txt surfaces',
      'Included in the sitemap and submitted via IndexNow',
      'Listed for a full year while your subscription is active',
    ],
  },
  {
    tier: 'featured',
    name: 'Featured',
    priceLabel: '$99',
    monthlyLabel: '$8.25',
    badge: 'Promoted placement',
    highlight: true,
    features: [
      'Everything in Standard',
      'Editorial double-width Featured card on directory pages',
      'Featured before Standard within the same directory page',
      'Eligible for one of up to three homepage Featured slots',
      'Included on the Featured page',
      'Order among Featured listings is re-seeded daily',
    ],
  },
]

export const usePlans = () => {
  // Unknown input resolves to Featured everywhere the funnel does, so one
  // stale value cannot produce two different answers on the same screen.
  const findPlan = (tier: string | null | undefined): Plan =>
    PLANS.find(p => p.tier === tier) ?? PLANS[1]!

  return { plans: PLANS, findPlan }
}
