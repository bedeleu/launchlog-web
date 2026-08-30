import { z } from 'zod'
import {
  isSafePreviewUrl,
  outreachSubjectVariants,
  type OutreachSubjectVariant,
} from '../utils/outreach-template'

export interface OutreachSendPayload {
  recipientEmail: string
  firstName: string | null
  productName: string
  sourceName: string
  subjectVariant: OutreachSubjectVariant
  subject: string
  text: string
  previewUrl: string | null
  requestId: string
}

export const outreachDeliveryChannels = ['resend', 'smtp'] as const
export const outreachDeliveryStatuses = [
  'pending',
  'accepted',
  'sent',
  'delivered',
  'delivery_delayed',
  'bounced',
  'complained',
  'failed',
  'suppressed',
  'canceled',
  'scheduled',
  'opened',
  'clicked',
  'unknown',
] as const

export type OutreachDeliveryChannel = typeof outreachDeliveryChannels[number]
export type OutreachDeliveryStatus = typeof outreachDeliveryStatuses[number]

export interface OutreachEmailSend {
  id: string
  request_id: string
  recipient_email: string
  first_name: string | null
  product_name: string
  source_name: string
  subject_variant: OutreachSubjectVariant
  subject: string
  text: string
  preview_url: string | null
  from_address: string
  from_name: string
  reply_to_address: string
  delivery_channel: OutreachDeliveryChannel
  provider_email_id: string | null
  status: OutreachDeliveryStatus
  accepted_at: string | null
  provider_event_at: string | null
  last_synced_at: string | null
  diagnostic_code: string | null
  created_at: string
  updated_at: string
}

const requestIdSchema = z.string().uuid()
const deliveryChannelSchema = z.enum(outreachDeliveryChannels)
const deliveryStatusSchema = z.enum(outreachDeliveryStatuses)
const nullableDateTimeSchema = z.string().datetime({ offset: true }).nullable()

export const outreachEmailSendSchema: z.ZodType<OutreachEmailSend> = z.object({
  id: z.string().uuid(),
  request_id: requestIdSchema,
  recipient_email: z.string().email(),
  first_name: z.string().nullable(),
  product_name: z.string(),
  source_name: z.string(),
  subject_variant: z.enum(outreachSubjectVariants),
  subject: z.string(),
  text: z.string(),
  preview_url: z.string().refine(isSafePreviewUrl).nullable(),
  from_address: z.string().email(),
  from_name: z.string(),
  reply_to_address: z.string().email(),
  delivery_channel: deliveryChannelSchema,
  provider_email_id: z.string().nullable(),
  status: deliveryStatusSchema,
  accepted_at: nullableDateTimeSchema,
  provider_event_at: nullableDateTimeSchema,
  last_synced_at: nullableDateTimeSchema,
  diagnostic_code: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
})

const sendResponseSchema = z.object({
  data: outreachEmailSendSchema,
})

export const useOutreachSend = () => {
  const config = useRuntimeConfig()
  const { getIdToken } = useAuth()

  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await getIdToken()
    if (!token) throw new Error('Not authenticated')
    return { Authorization: `Bearer ${token}` }
  }

  const send = async (payload: OutreachSendPayload): Promise<OutreachEmailSend> => {
    const response: unknown = await $fetch(
      `${config.public.apiUrl}/api/v1/admin/outreach/send`,
      {
        method: 'POST',
        headers: await authHeaders(),
        body: {
          recipient_email: payload.recipientEmail,
          first_name: payload.firstName,
          product_name: payload.productName,
          source_name: payload.sourceName,
          subject_variant: payload.subjectVariant,
          subject: payload.subject,
          text: payload.text,
          preview_url: payload.previewUrl,
          request_id: payload.requestId,
        },
      },
    )

    const parsed = sendResponseSchema.safeParse(response)
    if (!parsed.success || parsed.data.data.request_id !== payload.requestId) {
      throw new Error('Invalid outreach delivery response')
    }

    return parsed.data.data
  }

  return { send }
}
