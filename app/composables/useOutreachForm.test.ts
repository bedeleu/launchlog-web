import { describe, expect, test } from 'bun:test'
import { createOutreachFormController } from './useOutreachForm'
import type { OutreachEmailSend, OutreachSendPayload } from './useOutreachSend'

const token = 'A'.repeat(64)
const previewUrl = `https://launchlog.ai/preview/${token}`
const initialRequestId = '8adf6d21-2bc6-4c96-8dd6-e17f83956275'
const resetRequestId = '65ae0c5a-74a4-4aa2-82df-acb15322b848'
const rotatedRequestId = '6e33a787-f2ed-4dc7-a24e-595943af4a9f'

const acceptedSendFixture: OutreachEmailSend = {
  id: 'f642097d-9070-4e00-b2e7-00f0e0e4ea6a',
  request_id: initialRequestId,
  recipient_email: 'founder@example.com',
  first_name: 'Maya',
  product_name: 'ShipFast',
  source_name: 'Product Hunt',
  subject_variant: 'preview',
  subject: 'I made a private LaunchLog preview for ShipFast',
  text: 'Exact body',
  preview_url: previewUrl,
  from_address: 'alex@launchlog.ai',
  from_name: 'Alex from LaunchLog',
  reply_to_address: 'alex@launchlog.ai',
  delivery_channel: 'resend',
  provider_email_id: 'email_outreach_1',
  status: 'accepted',
  accepted_at: '2026-08-30T12:00:00Z',
  provider_event_at: null,
  last_synced_at: null,
  diagnostic_code: null,
  created_at: '2026-08-30T11:59:59Z',
  updated_at: '2026-08-30T12:00:00Z',
}

const createRequestIds = () => {
  const ids = [initialRequestId, resetRequestId, rotatedRequestId]
  return () => ids.shift() ?? '91aae5ad-6fa8-4683-8af5-59160ed27b72'
}

const fillValidContext = (form: ReturnType<typeof createOutreachFormController>, overrides: Partial<Record<keyof typeof form.context, string>> = {}) => {
  Object.assign(form.context, {
    recipientEmail: ' founder@example.com ',
    firstName: ' Maya ',
    productName: ' ShipFast ',
    sourceName: ' Product Hunt ',
    previewUrl: ` ${previewUrl} `,
    ...overrides,
  })
}

describe('outreach form controller', () => {
  test('sends the complete normalized payload then resets with a fresh request id', async () => {
    const sent: OutreachSendPayload[] = []
    const form = createOutreachFormController({
      randomUUID: createRequestIds(),
      verifyPreview: async () => ({ ok: true }),
      send: async (payload) => {
        sent.push(payload)
        return acceptedSendFixture
      },
    })
    fillValidContext(form)

    form.createDraft()
    const outcome = await form.submit()

    expect(outcome).toBe('accepted')
    expect(sent).toEqual([{
      recipientEmail: 'founder@example.com',
      firstName: 'Maya',
      productName: 'ShipFast',
      sourceName: 'Product Hunt',
      subjectVariant: 'preview',
      subject: 'I made a private LaunchLog preview for ShipFast',
      text: [
        'Hi Maya,',
        '',
        'I found ShipFast on Product Hunt and thought it would be a good fit for LaunchLog.',
        '',
        'I made a private preview so you can see how it would look:',
        previewUrl,
        '',
        'Nothing has been published. You can review it first and decide whether you want to publish.',
        '',
        'If this is not relevant, just let me know and I will not follow up.',
        '',
        'Alex',
        'LaunchLog.ai — The log of what just shipped.',
        'AB Solutions SRL · Timișoara, Romania',
      ].join('\n'),
      previewUrl,
      requestId: initialRequestId,
    }])
    expect(form.context).toEqual({
      recipientEmail: '', firstName: '', productName: '', sourceName: '', previewUrl: '',
    })
    expect(form.subject.value).toBe('')
    expect(form.text.value).toBe('')
    expect(form.subjectVariant.value).toBe('preview')
    expect(form.requestId.value).toBe(resetRequestId)
    expect(form.notice.value).toEqual({ kind: 'success', message: 'Email accepted for delivery.' })
    expect(form.lastAttemptFingerprint.value).toBe('')
    expect(form.draftSignature.value).toBe('')
  })

  test('preserves the final draft and request id when the provider rejects it', async () => {
    const form = createOutreachFormController({
      randomUUID: createRequestIds(),
      verifyPreview: async () => ({ ok: true }),
      send: async () => { throw { data: { message: 'The provider rejected this recipient.' } } },
    })
    fillValidContext(form)
    form.createDraft()
    form.selectSubjectVariant('fit')
    form.subject.value = 'A hand-written final subject'
    const draft = { subject: form.subject.value, text: form.text.value }

    const outcome = await form.submit()

    expect(outcome).toBe('failed')
    expect(form.context.productName).toBe(' ShipFast ')
    expect(form.subject.value).toBe(draft.subject)
    expect(form.text.value).toBe(draft.text)
    expect(form.subjectVariant.value).toBe('fit')
    expect(form.requestId.value).toBe(initialRequestId)
    expect(form.notice.value).toEqual({ kind: 'error', message: 'The provider rejected this recipient.' })
  })

  test('rejects invalid, expired, mismatched, and unavailable previews before calling send', async () => {
    const cases = [
      { result: { ok: false as const, message: 'The preview is not ready yet.' }, expected: 'The preview is not ready yet.' },
      { result: { ok: false as const, message: 'The preview has expired.' }, expected: 'The preview has expired.' },
      { result: { ok: false as const, message: 'The preview response did not match this link.' }, expected: 'The preview response did not match this link.' },
      { result: new Error('unavailable'), expected: 'The preview could not be verified. Review the link and try again.' },
    ]

    for (const current of cases) {
      let calls = 0
      const form = createOutreachFormController({
        randomUUID: createRequestIds(),
        verifyPreview: async () => {
          if (current.result instanceof Error) throw current.result
          return current.result
        },
        send: async () => {
          calls += 1
          return acceptedSendFixture
        },
      })
      fillValidContext(form)
      form.createDraft()

      expect(await form.submit()).toBe('invalid')
      expect(calls).toBe(0)
      expect(form.contextErrors.previewUrl).toBe(current.expected)
      expect(form.requestId.value).toBe(initialRequestId)
    }
  })

  test('does not retrieve a preview when the canonical preview field is empty', async () => {
    let verified = 0
    let sent = 0
    const form = createOutreachFormController({
      randomUUID: createRequestIds(),
      verifyPreview: async () => {
        verified += 1
        return { ok: true }
      },
      send: async () => {
        sent += 1
        return acceptedSendFixture
      },
    })
    fillValidContext(form, { previewUrl: '' })
    form.createDraft()

    expect(await form.submit()).toBe('accepted')
    expect(verified).toBe(0)
    expect(sent).toBe(1)
  })

  test('changes only the seeded subject for an explicit variant and preserves later manual edits', () => {
    const form = createOutreachFormController({
      randomUUID: createRequestIds(),
      verifyPreview: async () => ({ ok: true }),
      send: async () => acceptedSendFixture,
    })
    fillValidContext(form)
    form.createDraft()

    form.selectSubjectVariant('source')
    expect(form.subject.value).toBe('Found ShipFast on Product Hunt')
    form.subject.value = 'Maya, a hand-written idea for ShipFast'
    form.selectSubjectVariant('fit')
    expect(form.subject.value).toBe('ShipFast could be a fit for LaunchLog')
    form.subject.value = 'The final handwritten subject'

    expect(form.subjectVariant.value).toBe('fit')
    expect(form.subject.value).toBe('The final handwritten subject')
  })

  test('blocks stale and duplicate submits without repeating external work', async () => {
    let resolveSend: (value: OutreachEmailSend) => void = () => {
      throw new Error('Send promise was not initialized.')
    }
    let sendCalls = 0
    const form = createOutreachFormController({
      randomUUID: createRequestIds(),
      verifyPreview: async () => ({ ok: true }),
      send: () => {
        sendCalls += 1
        return new Promise<OutreachEmailSend>((resolve) => { resolveSend = resolve })
      },
    })
    fillValidContext(form)
    form.createDraft()
    form.context.productName = 'Changed product'

    expect(await form.submit()).toBe('invalid')
    expect(sendCalls).toBe(0)

    form.createDraft()
    const firstSubmit = form.submit()
    expect(await form.submit()).toBe('invalid')
    expect(sendCalls).toBe(1)
    resolveSend(acceptedSendFixture)
    expect(await firstSubmit).toBe('accepted')
  })

  test('rotates the request id only when changed content follows a failed provider attempt', async () => {
    const sent: OutreachSendPayload[] = []
    const form = createOutreachFormController({
      randomUUID: createRequestIds(),
      verifyPreview: async () => ({ ok: true }),
      send: async (payload) => {
        sent.push(payload)
        if (sent.length === 1) throw new Error('network failed')
        return acceptedSendFixture
      },
    })
    fillValidContext(form)
    form.createDraft()

    expect(await form.submit()).toBe('failed')
    expect(form.requestId.value).toBe(initialRequestId)
    form.subject.value = 'A changed final subject'

    expect(await form.submit()).toBe('accepted')
    expect(sent.map(payload => payload.requestId)).toEqual([initialRequestId, resetRequestId])
    expect(form.requestId.value).toBe(rotatedRequestId)
  })

  test('verifies the preview before it submits the provider payload', async () => {
    const order: string[] = []
    const form = createOutreachFormController({
      randomUUID: createRequestIds(),
      verifyPreview: async () => {
        order.push('preview')
        return { ok: true }
      },
      send: async () => {
        order.push('send')
        return acceptedSendFixture
      },
    })
    fillValidContext(form)
    form.createDraft()

    await form.submit()

    expect(order).toEqual(['preview', 'send'])
  })
})
