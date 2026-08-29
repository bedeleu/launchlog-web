import { resolvePlausibleCapability } from './plausible-capability'
import { isProductionDeployment, type DeploymentEnvironment } from './legal-readiness'

export const assertProductionAnalytics = (
  environment: DeploymentEnvironment,
  input: { enabled: unknown, domain: unknown, endpoint: unknown, siteDomain?: unknown },
): void => {
  if (!isProductionDeployment(environment)) return

  if (input.enabled === false || input.enabled === 'false') return

  const explicitlyEnabled = input.enabled === true || input.enabled === 'true'

  const capability = resolvePlausibleCapability({ ...input, enabled: explicitlyEnabled })
  if (capability === null) {
    throw new Error('Production Plausible configuration is incomplete or unsafe: set NUXT_PUBLIC_PLAUSIBLE_ENABLED explicitly to false, or set it to true with NUXT_PUBLIC_PLAUSIBLE_DOMAIN and NUXT_PUBLIC_PLAUSIBLE_ENDPOINT')
  }

  if (
    typeof input.siteDomain !== 'string'
    || input.siteDomain !== new URL(capability.origin).hostname
  ) {
    throw new Error('Production Plausible domain mismatch: NUXT_PUBLIC_PLAUSIBLE_DOMAIN must exactly match NUXT_PUBLIC_DOMAIN')
  }
}
