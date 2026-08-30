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

const isoOffsetPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/

const isGregorianLeapYear = (year: number): boolean => (
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
)

const daysInGregorianMonth = (year: number, month: number): number => {
  if (month === 2) return isGregorianLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

const daysSinceUnixEpoch = (year: number, month: number, day: number): bigint => {
  const adjustedYear = year - (month <= 2 ? 1 : 0)
  const era = Math.trunc((adjustedYear >= 0 ? adjustedYear : adjustedYear - 399) / 400)
  const yearOfEra = adjustedYear - era * 400
  const adjustedMonth = month + (month > 2 ? -3 : 9)
  const dayOfYear = Math.trunc((153 * adjustedMonth + 2) / 5) + day - 1
  const dayOfEra = yearOfEra * 365
    + Math.trunc(yearOfEra / 4)
    - Math.trunc(yearOfEra / 100)
    + dayOfYear

  return BigInt(era * 146_097 + dayOfEra - 719_468)
}

export const parseIsoOffsetToMicroseconds = (value: string): bigint | null => {
  const match = isoOffsetPattern.exec(value)
  if (!match) return null

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = '', , offsetSign, offsetHourText = '00', offsetMinuteText = '00'] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const offsetHour = Number(offsetHourText)
  const offsetMinute = Number(offsetMinuteText)

  if (
    month < 1
    || month > 12
    || day < 1
    || day > daysInGregorianMonth(year, month)
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHour > 23
    || offsetMinute > 59
  ) return null

  const dayMicroseconds = daysSinceUnixEpoch(year, month, day) * 86_400_000_000n
  const timeMicroseconds = BigInt(hour) * 3_600_000_000n
    + BigInt(minute) * 60_000_000n
    + BigInt(second) * 1_000_000n
    + BigInt(fraction.padEnd(6, '0'))
  const offsetDirection = offsetSign === '-' ? -1n : 1n
  const offsetMicroseconds = offsetDirection
    * BigInt(offsetHour * 60 + offsetMinute)
    * 60_000_000n

  return dayMicroseconds + timeMicroseconds - offsetMicroseconds
}

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
  from_address: string | null
  from_name: string | null
  reply_to_address: string | null
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
const dateTimeSchema = z.string().refine(
  value => parseIsoOffsetToMicroseconds(value) !== null,
  'Invalid ISO offset timestamp',
)
const nullableDateTimeSchema = dateTimeSchema.nullable()

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
  from_address: z.string().email().nullable(),
  from_name: z.string().nullable(),
  reply_to_address: z.string().email().nullable(),
  delivery_channel: deliveryChannelSchema,
  provider_email_id: z.string().nullable(),
  status: deliveryStatusSchema,
  accepted_at: nullableDateTimeSchema,
  provider_event_at: nullableDateTimeSchema,
  last_synced_at: nullableDateTimeSchema,
  diagnostic_code: z.string().nullable(),
  created_at: dateTimeSchema,
  updated_at: dateTimeSchema,
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
