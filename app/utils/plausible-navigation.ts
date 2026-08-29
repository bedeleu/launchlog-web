import type { PlausibleCapability } from './plausible-privacy'
import { sanitizePublicAnalyticsUrl } from './plausible-privacy'

export const shouldTrackPlausibleNavigation = (
  toFullPath: string,
  fromFullPath: string,
  failure: unknown,
  capability: PlausibleCapability,
): boolean => {
  if (failure !== undefined && failure !== null) return false

  const destination = sanitizePublicAnalyticsUrl(toFullPath, capability)
  if (destination === null) return false

  return destination !== sanitizePublicAnalyticsUrl(fromFullPath, capability)
}
