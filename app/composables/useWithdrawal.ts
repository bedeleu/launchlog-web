import type { CheckoutLegalLocale } from '#shared/constants/checkout-legal'

export interface WithdrawalSubmission {
  client_request_id: string
  name: string
  contract_details: string
  confirmation_email: string
  locale: CheckoutLegalLocale
}

export interface WithdrawalReceipt {
  receipt_reference: string
  submitted_at: string
  declaration_text: string
  confirmation_email: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseWithdrawalReceipt = (
  value: unknown,
  expectedEmail: string,
): WithdrawalReceipt => {
  if (
    !isRecord(value)
    || typeof value.receipt_reference !== 'string'
    || !/^[A-Za-z0-9_-]{3,120}$/.test(value.receipt_reference)
    || typeof value.submitted_at !== 'string'
    || !Number.isFinite(Date.parse(value.submitted_at))
    || typeof value.declaration_text !== 'string'
    || value.declaration_text.trim().length < 10
    || value.declaration_text.trim().length > 2_000
    || typeof value.confirmation_email !== 'string'
    || value.confirmation_email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()
  ) {
    throw new Error('The withdrawal service returned an invalid receipt.')
  }

  return {
    receipt_reference: value.receipt_reference,
    submitted_at: value.submitted_at,
    declaration_text: value.declaration_text.trim(),
    confirmation_email: value.confirmation_email.trim(),
  }
}

export const useWithdrawal = () => {
  const config = useRuntimeConfig()
  const endpoint = `${config.public.apiUrl}/api/v1/withdrawals`
  let inFlight: Promise<WithdrawalReceipt> | null = null

  const submit = (input: WithdrawalSubmission): Promise<WithdrawalReceipt> => {
    if (inFlight) return inFlight

    const body: WithdrawalSubmission = {
      client_request_id: input.client_request_id,
      name: input.name,
      contract_details: input.contract_details,
      confirmation_email: input.confirmation_email,
      locale: input.locale,
    }

    inFlight = $fetch<unknown>(endpoint, {
      method: 'POST',
      body,
    }).then((response) => {
      if (!isRecord(response)) {
        throw new Error('The withdrawal service returned an invalid receipt.')
      }

      return parseWithdrawalReceipt(response.data, body.confirmation_email)
    }).finally(() => {
      inFlight = null
    })

    return inFlight
  }

  return { submit }
}
