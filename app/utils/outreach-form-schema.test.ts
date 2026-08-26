import { describe, expect, test } from 'bun:test'

interface SchemaIssue {
  path: Array<string | number>
}

type ObjectParseResult =
  | { success: true, data: Record<string, unknown> }
  | { success: false, error: { issues: SchemaIssue[] } }

type StringParseResult =
  | { success: true, data: string }
  | { success: false, error: { issues: SchemaIssue[] } }

interface ObjectSchema {
  safeParse: (input: unknown) => ObjectParseResult
}

interface StringSchema {
  safeParse: (input: unknown) => StringParseResult
}

interface OutreachFormSchemaModule {
  outreachCampaignCreateSchema: ObjectSchema
  outreachCampaignUpdateSchema: ObjectSchema
  outreachCandidateCreateSchema: ObjectSchema
  outreachProspectEditSchema: ObjectSchema
  outreachDraftEditSchema: ObjectSchema
  outreachApprovalSchema: ObjectSchema
  outreachSuppressionSchema: ObjectSchema
  outreachExportSchema: ObjectSchema
  outreachSuppressionReasonSchema: StringSchema
}

const modulePath = ['./outreach-form-schema', 'ts'].join('.')
const schemas = await import(modulePath) as OutreachFormSchemaModule

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
const MAX_INTEGER = 2_147_483_647
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const campaignCreate = {
  name: 'Founders 2026',
  key: 'founders-2026',
  sender_identity_label: 'Warmed founder domain',
}

const candidateCreate = {
  campaign_key: 'founders-2026',
  company_name: 'Acme Labs',
  product_name: 'Acme Launch',
  product_url: 'https://acme.test/product',
  founder_first_name: 'Ada',
  business_email: 'ada@acme.test',
  country_code: 'US',
  source_url: 'https://directory.test/acme',
  source_context: 'Public founder profile.',
  notes: 'Review the product positioning.',
  source_attested: true,
}

function parse(schema: ObjectSchema, input: unknown): Record<string, unknown> {
  const result = schema.safeParse(input)
  expect(result.success).toBeTrue()
  if (!result.success) {
    throw new Error('Expected schema input to parse.')
  }

  return result.data
}

function reject(schema: ObjectSchema, input: unknown, field?: string): void {
  const result = schema.safeParse(input)
  expect(result.success).toBeFalse()
  if (result.success || field === undefined) {
    return
  }

  expect(result.error.issues.some(issue => issue.path[0] === field)).toBeTrue()
}

function astral(count: number): string {
  return '😀'.repeat(count)
}

function urlAtCodePoints(count: number): string {
  const prefix = 'https://example.test/'
  return `${prefix}${'a'.repeat(count - Array.from(prefix).length)}`
}

function emailAtCodePoints(count: number): string {
  const suffix = '@example.test'
  return `${'a'.repeat(count - suffix.length)}${suffix}`
}

function uniqueUlids(count: number): string[] {
  const prefix = ULID.slice(0, 24)

  return Array.from({ length: count }, (_, index) => {
    const high = Math.floor(index / CROCKFORD.length)
    const low = index % CROCKFORD.length
    return `${prefix}${CROCKFORD[high]}${CROCKFORD[low]}`
  })
}

describe('outreach campaign schemas', () => {
  test('trim exact create fields and enforce canonical keys', () => {
    expect(parse(schemas.outreachCampaignCreateSchema, {
      name: '  Founders 2026  ',
      key: '  founders-2026  ',
      sender_identity_label: '  Warm domain A  ',
      ignored: 'must not enter the payload',
    })).toEqual({
      name: 'Founders 2026',
      key: 'founders-2026',
      sender_identity_label: 'Warm domain A',
    })

    for (const key of ['Founders-2026', 'founders_2026', '-founders', 'founders-', 'föö']) {
      reject(schemas.outreachCampaignCreateSchema, { ...campaignCreate, key }, 'key')
    }
  })

  test('enforce campaign name, key, and sender code-point limits', () => {
    parse(schemas.outreachCampaignCreateSchema, { ...campaignCreate, name: astral(120) })
    reject(schemas.outreachCampaignCreateSchema, { ...campaignCreate, name: astral(121) }, 'name')
    parse(schemas.outreachCampaignCreateSchema, { ...campaignCreate, key: 'a'.repeat(80) })
    reject(schemas.outreachCampaignCreateSchema, { ...campaignCreate, key: 'a'.repeat(81) }, 'key')
    parse(schemas.outreachCampaignCreateSchema, { ...campaignCreate, sender_identity_label: astral(120) })
    reject(schemas.outreachCampaignCreateSchema, { ...campaignCreate, sender_identity_label: astral(121) }, 'sender_identity_label')
  })

  test('require at least one exact mutable campaign field', () => {
    reject(schemas.outreachCampaignUpdateSchema, {})
    reject(schemas.outreachCampaignUpdateSchema, { key: 'cannot-change' })
    expect(parse(schemas.outreachCampaignUpdateSchema, { status: 'active', key: 'cannot-change' }))
      .toEqual({ status: 'active' })
    reject(schemas.outreachCampaignUpdateSchema, { status: 'paused' }, 'status')
    parse(schemas.outreachCampaignUpdateSchema, { name: astral(120) })
    reject(schemas.outreachCampaignUpdateSchema, { name: astral(121) }, 'name')
  })
})

describe('candidate and prospect schemas', () => {
  test('normalize contact fields without retaining caller extras', () => {
    expect(parse(schemas.outreachCandidateCreateSchema, {
      ...candidateCreate,
      campaign_key: '  founders-2026  ',
      company_name: '  Acme Labs  ',
      founder_first_name: '   ',
      business_email: '  ADA@ACME.TEST  ',
      country_code: ' ro ',
      notes: '   ',
      token: 'must-not-pass',
      normalized_email_hash: 'must-not-pass',
    })).toEqual({
      ...candidateCreate,
      campaign_key: 'founders-2026',
      company_name: 'Acme Labs',
      founder_first_name: null,
      business_email: 'ada@acme.test',
      country_code: 'RO',
      notes: null,
    })
  })

  test('reject formula-prefixed or malformed email and normalize nullable country', () => {
    for (const business_email of ['=cmd@example.test', '+cmd@example.test', '-cmd@example.test', '@cmd@example.test', 'not-email']) {
      reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, business_email }, 'business_email')
    }

    expect(parse(schemas.outreachCandidateCreateSchema, { ...candidateCreate, country_code: '' }).country_code).toBeNull()
    expect(parse(schemas.outreachCandidateCreateSchema, { ...candidateCreate, country_code: null }).country_code).toBeNull()
    reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, country_code: 'USA' }, 'country_code')
    reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, country_code: 'R1' }, 'country_code')
  })

  test('assist only credential-free HTTP(S) URLs with a hostname', () => {
    parse(schemas.outreachCandidateCreateSchema, {
      ...candidateCreate,
      product_url: ' http://127.0.0.1/product ',
      source_url: ' https://directory.test/source ',
    })

    for (const product_url of [
      'ftp://acme.test/product',
      'https://user:secret@acme.test/product',
      'https:///missing-host',
      '/relative-only',
      'not a url',
    ]) {
      reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, product_url }, 'product_url')
    }
  })

  test('enforce every candidate string cap by Unicode code point', () => {
    const cappedText: Array<[string, number]> = [
      ['company_name', 120],
      ['product_name', 120],
      ['founder_first_name', 80],
      ['source_context', 300],
      ['notes', 2000],
    ]

    for (const [field, limit] of cappedText) {
      parse(schemas.outreachCandidateCreateSchema, { ...candidateCreate, [field]: astral(limit) })
      reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, [field]: astral(limit + 1) }, field)
    }

    for (const field of ['product_url', 'source_url']) {
      parse(schemas.outreachCandidateCreateSchema, { ...candidateCreate, [field]: urlAtCodePoints(2048) })
      reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, [field]: urlAtCodePoints(2049) }, field)
    }

    parse(schemas.outreachCandidateCreateSchema, { ...candidateCreate, business_email: emailAtCodePoints(255) })
    reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, business_email: emailAtCodePoints(256) }, 'business_email')
  })

  test('require literal source attestation on create and prospect edit', () => {
    reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, source_attested: false }, 'source_attested')
    reject(schemas.outreachCandidateCreateSchema, { ...candidateCreate, source_attested: 1 }, 'source_attested')
    reject(schemas.outreachProspectEditSchema, { expected_revision: 4, source_attested: false, company_name: 'Acme' }, 'source_attested')
    parse(schemas.outreachProspectEditSchema, { expected_revision: 4, source_attested: true, company_name: 'Acme' })
  })

  test('require a bounded integer revision and one mutable prospect field', () => {
    reject(schemas.outreachProspectEditSchema, { expected_revision: 4, source_attested: true })
    reject(schemas.outreachProspectEditSchema, { expected_revision: -1, source_attested: true, notes: null }, 'expected_revision')
    reject(schemas.outreachProspectEditSchema, { expected_revision: 1.5, source_attested: true, notes: null }, 'expected_revision')
    reject(schemas.outreachProspectEditSchema, { expected_revision: MAX_INTEGER + 1, source_attested: true, notes: null }, 'expected_revision')
    parse(schemas.outreachProspectEditSchema, { expected_revision: 0, source_attested: true, notes: null })
    parse(schemas.outreachProspectEditSchema, { expected_revision: MAX_INTEGER, source_attested: true, notes: 'reviewed' })
  })
})

describe('draft, approval, suppression, and export schemas', () => {
  test('enforce exact draft caps and require one mutable field', () => {
    reject(schemas.outreachDraftEditSchema, { expected_revision: 2 })

    const cappedDraft: Array<[string, number]> = [
      ['subject_line', 200],
      ['opening_line', 500],
      ['email_body', 5000],
    ]

    for (const [field, limit] of cappedDraft) {
      parse(schemas.outreachDraftEditSchema, { expected_revision: 2, [field]: astral(limit) })
      reject(schemas.outreachDraftEditSchema, { expected_revision: 2, [field]: astral(limit + 1) }, field)
    }

    reject(schemas.outreachDraftEditSchema, { expected_revision: -1, subject_line: 'Subject' }, 'expected_revision')
    reject(schemas.outreachDraftEditSchema, { expected_revision: 2, subject_line: '   ' }, 'subject_line')
  })

  test('require both literal approval confirmations and bounded revision', () => {
    expect(parse(schemas.outreachApprovalSchema, {
      expected_revision: MAX_INTEGER,
      confirm_english_plain_text: true,
      confirm_public_source: true,
    })).toEqual({
      expected_revision: MAX_INTEGER,
      confirm_english_plain_text: true,
      confirm_public_source: true,
    })

    reject(schemas.outreachApprovalSchema, {
      expected_revision: 1,
      confirm_english_plain_text: false,
      confirm_public_source: true,
    }, 'confirm_english_plain_text')
    reject(schemas.outreachApprovalSchema, {
      expected_revision: 1,
      confirm_english_plain_text: true,
      confirm_public_source: 1,
    }, 'confirm_public_source')
  })

  test('validate suppression target, source, confirmation, and reason code points', () => {
    const base = {
      prospect_public_id: ULID,
      expected_revision: 8,
      target: 'effective_domain',
      reason: '  Asked not to be contacted  ',
      source: 'opt_out',
      confirm: true,
    }
    expect(parse(schemas.outreachSuppressionSchema, base)).toEqual({
      ...base,
      reason: 'Asked not to be contacted',
    })

    for (const target of ['raw_email', 'domain', null]) {
      reject(schemas.outreachSuppressionSchema, { ...base, target }, 'target')
    }
    reject(schemas.outreachSuppressionSchema, { ...base, source: 'provider' }, 'source')
    reject(schemas.outreachSuppressionSchema, { ...base, confirm: false }, 'confirm')
    reject(schemas.outreachSuppressionSchema, { ...base, prospect_public_id: ULID.toLowerCase() }, 'prospect_public_id')
    reject(schemas.outreachSuppressionSchema, { ...base, expected_revision: MAX_INTEGER + 1 }, 'expected_revision')

    expect(schemas.outreachSuppressionReasonSchema.safeParse(astral(500)).success).toBeTrue()
    expect(schemas.outreachSuppressionReasonSchema.safeParse(astral(501)).success).toBeFalse()
    expect(schemas.outreachSuppressionReasonSchema.safeParse('   ').success).toBeFalse()
  })

  test('accept one to one hundred unique canonical IDs and explicit false re-export confirmation', () => {
    expect(parse(schemas.outreachExportSchema, {
      campaign_key: 'founders-2026',
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    })).toEqual({
      campaign_key: 'founders-2026',
      prospect_public_ids: [ULID],
      confirm_reexport: false,
    })

    parse(schemas.outreachExportSchema, {
      campaign_key: 'founders-2026',
      prospect_public_ids: uniqueUlids(100),
      confirm_reexport: true,
    })
    reject(schemas.outreachExportSchema, {
      campaign_key: 'founders-2026',
      prospect_public_ids: uniqueUlids(101),
      confirm_reexport: false,
    }, 'prospect_public_ids')
    reject(schemas.outreachExportSchema, {
      campaign_key: 'founders-2026',
      prospect_public_ids: [],
      confirm_reexport: false,
    }, 'prospect_public_ids')
    reject(schemas.outreachExportSchema, {
      campaign_key: 'founders-2026',
      prospect_public_ids: [ULID, ULID],
      confirm_reexport: false,
    }, 'prospect_public_ids')
    reject(schemas.outreachExportSchema, {
      campaign_key: 'founders-2026',
      prospect_public_ids: [ULID.toLowerCase()],
      confirm_reexport: false,
    }, 'prospect_public_ids')
    reject(schemas.outreachExportSchema, {
      campaign_key: 'founders-2026',
      prospect_public_ids: [ULID],
      confirm_reexport: 'false',
    }, 'confirm_reexport')
  })
})
