export type PlanTier = 'basic' | 'premium' | 'featured'

export interface Plan {
  tier: PlanTier
  name: string
  /** Annual price, e.g. "$24.99". */
  priceLabel: string
  /** Optional crossed-out anchor price. */
  compareAtLabel?: string
  /** Monthly equivalent, e.g. "$2.08". */
  monthlyLabel: string
  features: string[]
  /** Short marketing badge, e.g. "Best visibility". */
  badge?: string
  /** The hero/most-valuable tier. */
  highlight?: boolean
}

// Pricing per D-058 (annual, USD). Monthly = annual / 12, for the "just $X/mo" framing.
const PLANS: Plan[] = [
  {
    tier: 'basic',
    name: 'Basic',
    priceLabel: '$24.99',
    monthlyLabel: '$2.08',
    features: [
      'Listed in the directory',
      'Real website screenshot',
      'Indexed in 24–48h',
      'schema.org + llms.txt + markdown',
      '1-year listing',
    ],
  },
  {
    tier: 'premium',
    name: 'Premium',
    priceLabel: '$59.99',
    monthlyLabel: '$5.00',
    badge: 'Most popular',
    features: [
      'Everything in Basic',
      'Homepage visibility',
      'Priority placement',
      'Featured in tech products',
      'Category top slot',
    ],
  },
  {
    tier: 'featured',
    name: 'Featured',
    priceLabel: '$99',
    compareAtLabel: '$149',
    monthlyLabel: '$8.25',
    badge: 'Best value',
    highlight: true,
    features: [
      'Everything in Premium',
      'Homepage featured spotlight',
      'Top of search results',
      'Dedicated Featured badge',
      'Launch discount from $149',
    ],
  },
]

export const usePlans = () => {
  const findPlan = (tier: string | null | undefined): Plan =>
    PLANS.find(p => p.tier === tier) ?? PLANS[0]!

  return { plans: PLANS, findPlan }
}
