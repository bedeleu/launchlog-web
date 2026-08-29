import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { parseWithdrawalReceipt, useWithdrawal, type WithdrawalSubmission } from './useWithdrawal'

const API = 'https://api.launchlog.test'
const globals = globalThis as unknown as Record<string, unknown>
let calls: Array<{ url: string, options?: Record<string, unknown> }>

beforeEach(() => {
  calls = []
  globals.useRuntimeConfig = () => ({ public: { apiUrl: API } })
  globals.$fetch = (url: string, options?: Record<string, unknown>) => {
    calls.push({ url, options })
    return Promise.resolve({
      data: {
        receipt_reference: 'WD-2026-000001',
        submitted_at: '2026-08-29T12:00:00Z',
        declaration_text: 'I withdraw from the identified contract.',
        confirmation_email: 'buyer@example.com',
      },
    })
  }
})

afterEach(() => {
  delete globals.useRuntimeConfig
  delete globals.$fetch
})

describe('online withdrawal submission', () => {
  test('posts only the required declaration fields without authentication or a reason', async () => {
    const payload: WithdrawalSubmission = {
      client_request_id: '018f4a6e-5b1d-7f55-9d0c-f9d94245838f',
      name: 'Alex Buyer',
      contract_details: 'LL-2026-ABC123',
      confirmation_email: 'buyer@example.com',
      locale: 'en',
    }

    const receipt = await useWithdrawal().submit(payload)

    expect(calls).toEqual([{
      url: `${API}/api/v1/withdrawals`,
      options: { method: 'POST', body: payload },
    }])
    expect(receipt.receipt_reference).toBe('WD-2026-000001')
    expect(calls[0]?.options?.body).not.toHaveProperty('reason')
  })

  test('coalesces a repeated confirmation while the first request is in flight', async () => {
    let release: ((value: unknown) => void) | undefined
    globals.$fetch = (url: string, options?: Record<string, unknown>) => {
      calls.push({ url, options })
      return new Promise(resolve => { release = resolve })
    }
    const withdrawal = useWithdrawal()
    const payload: WithdrawalSubmission = {
      client_request_id: '018f4a6e-5b1d-7f55-9d0c-f9d94245838f',
      name: 'Alex Buyer',
      contract_details: 'LL-2026-ABC123',
      confirmation_email: 'buyer@example.com',
      locale: 'ro',
    }

    const first = withdrawal.submit(payload)
    const second = withdrawal.submit(payload)
    await Promise.resolve()
    expect(calls).toHaveLength(1)
    release?.({ data: {
      receipt_reference: 'WD-1',
      submitted_at: '2026-08-29T12:00:00Z',
      declaration_text: 'Mă retrag din contractul identificat.',
      confirmation_email: 'buyer@example.com',
    } })
    await Promise.all([first, second])
  })

  test('fails closed instead of announcing a malformed or mismatched receipt', async () => {
    for (const receipt of [
      null,
      { receipt_reference: 'WD-1' },
      {
        receipt_reference: 'WD-1',
        submitted_at: 'not-a-date',
        declaration_text: 'I withdraw from the contract.',
        confirmation_email: 'buyer@example.com',
      },
      {
        receipt_reference: 'WD-1',
        submitted_at: '2026-08-29T12:00:00Z',
        declaration_text: 'I withdraw from the contract.',
        confirmation_email: 'another@example.com',
      },
    ]) {
      globals.$fetch = () => Promise.resolve({ data: receipt })
      await expect(useWithdrawal().submit({
        client_request_id: '018f4a6e-5b1d-7f55-9d0c-f9d94245838f',
        name: 'Alex Buyer',
        contract_details: 'LL-2026-ABC123',
        confirmation_email: 'buyer@example.com',
        locale: 'en',
      })).rejects.toThrow('invalid receipt')
    }
  })

  test('returns only validated receipt fields', () => {
    expect(parseWithdrawalReceipt({
      receipt_reference: 'WD-2026-000001',
      submitted_at: '2026-08-29T12:00:00Z',
      declaration_text: ' I withdraw from the identified contract. ',
      confirmation_email: 'buyer@example.com',
      ignored: 'not returned',
    }, 'BUYER@example.com')).toEqual({
      receipt_reference: 'WD-2026-000001',
      submitted_at: '2026-08-29T12:00:00Z',
      declaration_text: 'I withdraw from the identified contract.',
      confirmation_email: 'buyer@example.com',
    })
  })
})
