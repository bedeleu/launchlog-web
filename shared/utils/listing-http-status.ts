export type ListingAbsenceStatus = 404 | 410

const nestedStatusSources = ['data', 'response', 'cause', 'error'] as const

export const extractHttpStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined

  const source = error as Record<string, unknown>
  const directStatus = source.statusCode ?? source.status
  if (typeof directStatus === 'number') return directStatus

  for (const key of nestedStatusSources) {
    const nestedStatus = extractHttpStatus(source[key])
    if (nestedStatus !== undefined) return nestedStatus
  }

  return undefined
}

export const listingAbsenceStatus = (
  error: unknown,
  listing: unknown,
): ListingAbsenceStatus | undefined => {
  const status = extractHttpStatus(error)
  if (status === 404 || status === 410) return status
  if (error !== undefined && error !== null) return undefined
  return listing === undefined || listing === null ? 404 : undefined
}
