export function parseCanonicalPageParam(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 1

  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= 1 ? raw : null
  }

  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null

  const page = Number(raw)

  return Number.isSafeInteger(page) && page >= 1 && String(page) === raw ? page : null
}
