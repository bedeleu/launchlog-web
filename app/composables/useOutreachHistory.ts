import { z } from 'zod'
import {
  outreachEmailSendSchema,
  type OutreachEmailSend,
} from './useOutreachSend'
import {
  normalizeOutreachAuthorizationError,
  OutreachAuthorizationError,
} from '../utils/outreach-auth'

export interface OutreachEmailSendPage {
  data: OutreachEmailSend[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
}

const pageNumberSchema = z.number().int().positive()
const sendIdSchema = z.string().uuid()
const paginationLinkSchema = z.string().url().refine((value) => {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  }
  catch {
    return false
  }
}).nullable()

const outreachEmailSendPageSchema: z.ZodType<OutreachEmailSendPage> = z.object({
  data: z.array(outreachEmailSendSchema),
  links: z.object({
    first: paginationLinkSchema,
    last: paginationLinkSchema,
    prev: paginationLinkSchema,
    next: paginationLinkSchema,
  }),
  meta: z.object({
    current_page: pageNumberSchema,
    from: pageNumberSchema.nullable(),
    last_page: pageNumberSchema,
    per_page: pageNumberSchema,
    to: pageNumberSchema.nullable(),
    total: z.number().int().nonnegative(),
  }),
}).superRefine((page, context) => {
  const { data, meta } = page
  const expectedLastPage = Math.max(1, Math.ceil(meta.total / meta.per_page))

  if (meta.last_page !== expectedLastPage || meta.current_page > meta.last_page) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid pagination boundary' })
  }

  if (data.length > meta.per_page) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Page exceeds page size' })
  }

  if (data.length === 0) {
    if (meta.from !== null || meta.to !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Empty page has a row range' })
    }
    return
  }

  if (meta.from === null || meta.to === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Populated page is missing its row range' })
    return
  }

  const expectedFrom = (meta.current_page - 1) * meta.per_page + 1
  if (
    meta.from !== expectedFrom
    || meta.to < meta.from
    || meta.to > meta.total
    || meta.to - meta.from + 1 !== data.length
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Page row range is inconsistent' })
  }
})

const outreachEmailSendResponseSchema = z.object({
  data: outreachEmailSendSchema,
})

export const useOutreachHistory = () => {
  const config = useRuntimeConfig()
  const { getIdToken } = useAuth()
  const endpoint = `${config.public.apiUrl}/api/v1/admin/outreach/sends`

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getIdToken()
    if (!token) throw new OutreachAuthorizationError()
    return { Authorization: `Bearer ${token}` }
  }

  const list = async (page: number): Promise<OutreachEmailSendPage> => {
    if (!pageNumberSchema.safeParse(page).success) {
      throw new Error('Invalid outreach history page')
    }

    let response: unknown
    try {
      response = await $fetch(endpoint, {
        cache: 'no-store',
        headers: await authHeaders(),
        query: { page },
      })
    }
    catch (error: unknown) {
      throw normalizeOutreachAuthorizationError(error)
    }
    const parsed = outreachEmailSendPageSchema.safeParse(response)

    if (!parsed.success || parsed.data.meta.current_page !== page) {
      throw new Error('Invalid outreach history response')
    }

    return parsed.data
  }

  const refresh = async (id: string): Promise<OutreachEmailSend> => {
    if (!sendIdSchema.safeParse(id).success) {
      throw new Error('Invalid outreach send ID')
    }

    let response: unknown
    try {
      response = await $fetch(`${endpoint}/${id}/refresh`, {
        cache: 'no-store',
        method: 'POST',
        headers: await authHeaders(),
      })
    }
    catch (error: unknown) {
      throw normalizeOutreachAuthorizationError(error)
    }
    const parsed = outreachEmailSendResponseSchema.safeParse(response)

    if (!parsed.success || parsed.data.data.id !== id) {
      throw new Error('Invalid outreach history response')
    }

    return parsed.data.data
  }

  return { list, refresh }
}
