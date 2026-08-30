import { computed, reactive, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { toErrorLike } from '../utils/error-like'
import {
  buildOutreachDraft,
  buildOutreachSubjectOptions,
  outreachContextSchema,
  outreachSendSchema,
  outreachSubjectVariants,
  parseOutreachPreviewUrl,
  verifyOutreachPreview,
} from '../utils/outreach-template'
import type {
  OutreachPreviewVerification,
  OutreachSubjectOption,
  OutreachSubjectVariant,
} from '../utils/outreach-template'
import { useOutreachSend } from './useOutreachSend'
import type { OutreachEmailSend, OutreachSendPayload } from './useOutreachSend'
import { usePreviews } from './usePreviews'

type ContextField = 'recipientEmail' | 'firstName' | 'productName' | 'sourceName' | 'previewUrl'
type DraftField = 'subject' | 'text'
type FormNotice = { kind: 'success' | 'error', message: string } | null

export interface OutreachFormDependencies {
  random: () => number
  randomUUID: () => string
  verifyPreview: (token: string) => Promise<OutreachPreviewVerification>
  send: (payload: OutreachSendPayload) => Promise<OutreachEmailSend>
}

export interface OutreachFormController {
  context: Record<ContextField, string>
  contextErrors: Record<ContextField, string>
  draftErrors: Record<DraftField, string>
  subject: Ref<string>
  text: Ref<string>
  subjectVariant: Ref<OutreachSubjectVariant>
  subjectOptions: ComputedRef<OutreachSubjectOption[]>
  requestId: Ref<string>
  draftSignature: Ref<string>
  lastAttemptFingerprint: Ref<string>
  sending: Ref<boolean>
  notice: Ref<FormNotice>
  hasDraft: ComputedRef<boolean>
  draftIsStale: ComputedRef<boolean>
  sendDisabled: ComputedRef<boolean>
  createDraft: () => boolean
  selectSubjectVariant: (variant: OutreachSubjectVariant) => void
  submit: () => Promise<'accepted' | 'invalid' | 'failed'>
}

const emptyContext = (): Record<ContextField, string> => ({
  recipientEmail: '',
  firstName: '',
  productName: '',
  sourceName: '',
  previewUrl: '',
})

const contextSignatureFor = (context: Record<ContextField, string>): string => JSON.stringify([
  context.recipientEmail.trim(),
  context.firstName.trim(),
  context.productName.trim(),
  context.sourceName.trim(),
  context.previewUrl.trim(),
])

const payloadFingerprint = (payload: Omit<OutreachSendPayload, 'requestId'>): string => JSON.stringify([
  payload.recipientEmail,
  payload.firstName,
  payload.productName,
  payload.sourceName,
  payload.subjectVariant,
  payload.subject,
  payload.text,
  payload.previewUrl,
])

export function createOutreachFormController(dependencies: OutreachFormDependencies): OutreachFormController {
  const context = reactive(emptyContext())
  const contextErrors = reactive<Record<ContextField, string>>(emptyContext())
  const draftErrors = reactive<Record<DraftField, string>>({ subject: '', text: '' })
  const subject = ref('')
  const text = ref('')
  const subjectVariant = ref<OutreachSubjectVariant>('preview')
  const requestId = ref(dependencies.randomUUID())
  const draftSignature = ref('')
  const lastAttemptFingerprint = ref('')
  const sending = ref(false)
  const notice = ref<FormNotice>(null)
  const contextSignature = computed(() => contextSignatureFor(context))
  const parsedContext = computed(() => outreachContextSchema.safeParse(context))
  const subjectOptions = computed<OutreachSubjectOption[]>(() => (
    parsedContext.value.success ? buildOutreachSubjectOptions(parsedContext.value.data) : []
  ))
  const hasDraft = computed(() => subject.value.trim() !== '' && text.value.trim() !== '')
  const draftIsStale = computed(() => hasDraft.value && draftSignature.value !== contextSignature.value)
  const sendDisabled = computed(() => sending.value || !hasDraft.value || draftIsStale.value)

  const clearErrors = (): void => {
    for (const key of Object.keys(contextErrors) as ContextField[]) contextErrors[key] = ''
    draftErrors.subject = ''
    draftErrors.text = ''
  }

  const applyIssues = (issues: Array<{ path: PropertyKey[], message: string }>): void => {
    for (const issue of issues) {
      const field = issue.path[0]
      if (typeof field === 'string' && field in contextErrors) {
        contextErrors[field as ContextField] ||= issue.message
      }
      if (field === 'subject' || field === 'text') draftErrors[field] ||= issue.message
    }
  }

  const createDraft = (): boolean => {
    clearErrors()
    notice.value = null
    const parsed = outreachContextSchema.safeParse(context)
    if (!parsed.success) {
      applyIssues(parsed.error.issues)
      return false
    }

    const variantIndex = Math.floor(dependencies.random() * outreachSubjectVariants.length)
    const variant = outreachSubjectVariants[variantIndex] ?? 'preview'
    subjectVariant.value = variant
    const draft = buildOutreachDraft(parsed.data, variant)
    subject.value = draft.subject
    text.value = draft.text
    draftSignature.value = contextSignature.value
    notice.value = { kind: 'success', message: 'Draft ready. Review it before sending.' }
    return true
  }

  const selectSubjectVariant = (variant: OutreachSubjectVariant): void => {
    subjectVariant.value = variant
    const parsed = outreachContextSchema.safeParse(context)
    if (!parsed.success) return
    const option = buildOutreachSubjectOptions(parsed.data).find(candidate => candidate.value === variant)
    if (option) subject.value = option.subject
  }

  const resetAfterAccepted = (): void => {
    Object.assign(context, emptyContext())
    clearErrors()
    subject.value = ''
    text.value = ''
    subjectVariant.value = 'preview'
    draftSignature.value = ''
    lastAttemptFingerprint.value = ''
    requestId.value = dependencies.randomUUID()
  }

  const submit = async (): Promise<'accepted' | 'invalid' | 'failed'> => {
    if (sending.value) return 'invalid'

    clearErrors()
    notice.value = null
    if (draftIsStale.value) {
      notice.value = { kind: 'error', message: 'Context changed. Create the draft again before sending.' }
      return 'invalid'
    }

    const parsedContextValue = outreachContextSchema.safeParse(context)
    const parsedDraft = outreachSendSchema.safeParse({
      recipientEmail: context.recipientEmail,
      subject: subject.value,
      text: text.value,
    })
    if (!parsedContextValue.success) applyIssues(parsedContextValue.error.issues)
    if (!parsedDraft.success) applyIssues(parsedDraft.error.issues)
    if (!parsedContextValue.success || !parsedDraft.success) return 'invalid'

    const preview = parsedContextValue.data.previewUrl
      ? parseOutreachPreviewUrl(parsedContextValue.data.previewUrl)
      : null
    if (parsedContextValue.data.previewUrl && !preview) {
      contextErrors.previewUrl = 'Paste a clean LaunchLog private preview URL.'
      return 'invalid'
    }

    sending.value = true
    if (preview) {
      try {
        const verification = await dependencies.verifyPreview(preview.token)
        if (!verification.ok) {
          contextErrors.previewUrl = verification.message
          sending.value = false
          return 'invalid'
        }
      }
      catch {
        contextErrors.previewUrl = 'The preview could not be verified. Review the link and try again.'
        sending.value = false
        return 'invalid'
      }
    }

    const payloadWithoutRequestId = {
      recipientEmail: parsedContextValue.data.recipientEmail,
      firstName: parsedContextValue.data.firstName || null,
      productName: parsedContextValue.data.productName,
      sourceName: parsedContextValue.data.sourceName,
      subjectVariant: subjectVariant.value,
      subject: parsedDraft.data.subject,
      text: parsedDraft.data.text,
      previewUrl: preview?.url ?? null,
    } satisfies Omit<OutreachSendPayload, 'requestId'>
    const fingerprint = payloadFingerprint(payloadWithoutRequestId)
    if (lastAttemptFingerprint.value && lastAttemptFingerprint.value !== fingerprint) {
      requestId.value = dependencies.randomUUID()
    }

    const payload: OutreachSendPayload = { ...payloadWithoutRequestId, requestId: requestId.value }
    lastAttemptFingerprint.value = fingerprint
    try {
      await dependencies.send(payload)
      resetAfterAccepted()
      notice.value = { kind: 'success', message: 'Email accepted for delivery.' }
      return 'accepted'
    }
    catch (error: unknown) {
      const normalized = toErrorLike(error)
      notice.value = {
        kind: 'error',
        message: normalized.data?.message ?? 'Could not send the email. The draft was preserved.',
      }
      return 'failed'
    }
    finally {
      sending.value = false
    }
  }

  return {
    context,
    contextErrors,
    draftErrors,
    subject,
    text,
    subjectVariant,
    subjectOptions,
    requestId,
    draftSignature,
    lastAttemptFingerprint,
    sending,
    notice,
    hasDraft,
    draftIsStale,
    sendDisabled,
    createDraft,
    selectSubjectVariant,
    submit,
  }
}

export function useOutreachForm(): OutreachFormController {
  const { send } = useOutreachSend()
  const { getPreview } = usePreviews()

  return createOutreachFormController({
    random: () => Math.random(),
    randomUUID: () => crypto.randomUUID(),
    verifyPreview: async token => verifyOutreachPreview(await getPreview(token), token),
    send,
  })
}
