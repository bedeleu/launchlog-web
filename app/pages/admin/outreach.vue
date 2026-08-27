<script setup lang="ts">
import { ArrowLeft, Check, LoaderCircle, RotateCcw, Send, Sparkles } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buildOutreachDraft,
  outreachContextSchema,
  outreachSendSchema,
} from '~/utils/outreach-template'
import { toErrorLike } from '~/utils/error-like'

definePageMeta({ middleware: 'admin' })
useHead({
  title: 'Send outreach email · LaunchLog',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
})

type ContextField = 'recipientEmail' | 'firstName' | 'productName' | 'sourceName' | 'previewUrl'
type DraftField = 'subject' | 'text'

const context = reactive<Record<ContextField, string>>({
  recipientEmail: '',
  firstName: '',
  productName: '',
  sourceName: '',
  previewUrl: '',
})
const contextErrors = reactive<Record<ContextField, string>>({
  recipientEmail: '',
  firstName: '',
  productName: '',
  sourceName: '',
  previewUrl: '',
})
const draftErrors = reactive<Record<DraftField, string>>({ subject: '', text: '' })
const subject = ref('')
const text = ref('')
const draftSignature = ref('')
const requestId = ref(crypto.randomUUID())
const lastAttemptFingerprint = ref('')
const sending = ref(false)
const accepted = ref(false)
const notice = ref<{ kind: 'success' | 'error', message: string } | null>(null)
const { send } = useOutreachSend()

const inputClass = 'mt-2 h-11 border-white/10 bg-black/20 text-brand-fg placeholder:text-brand-muted hover:border-white/20 focus-visible:border-brand-accent/70 focus-visible:ring-brand-accent/30'
const contextSignature = computed(() => JSON.stringify([
  context.firstName.trim(),
  context.productName.trim(),
  context.sourceName.trim(),
  context.previewUrl.trim(),
]))
const hasDraft = computed(() => subject.value.trim() !== '' && text.value.trim() !== '')
const draftIsStale = computed(() => hasDraft.value && draftSignature.value !== contextSignature.value)
const sendDisabled = computed(() => sending.value || accepted.value || !hasDraft.value || draftIsStale.value)

function clearErrors(): void {
  for (const key of Object.keys(contextErrors) as ContextField[]) contextErrors[key] = ''
  draftErrors.subject = ''
  draftErrors.text = ''
  notice.value = null
}

function applyIssues(issues: Array<{ path: PropertyKey[], message: string }>): void {
  for (const issue of issues) {
    const field = issue.path[0]
    if (typeof field === 'string' && field in contextErrors) {
      contextErrors[field as ContextField] ||= issue.message
    }
    if (field === 'subject' || field === 'text') {
      draftErrors[field] ||= issue.message
    }
  }
}

async function focusFirstError(): Promise<void> {
  await nextTick()
  document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}

async function createDraft(): Promise<void> {
  clearErrors()
  const parsed = outreachContextSchema.safeParse(context)

  if (!parsed.success) {
    applyIssues(parsed.error.issues)
    await focusFirstError()
    return
  }

  const draft = buildOutreachDraft(parsed.data)
  subject.value = draft.subject
  text.value = draft.text
  draftSignature.value = contextSignature.value
  notice.value = { kind: 'success', message: 'Draft ready. Review it before sending.' }
}

async function sendEmail(): Promise<void> {
  clearErrors()
  if (draftIsStale.value) {
    notice.value = { kind: 'error', message: 'Context changed. Create the draft again before sending.' }
    return
  }

  const parsed = outreachSendSchema.safeParse({
    recipientEmail: context.recipientEmail,
    subject: subject.value,
    text: text.value,
  })

  if (!parsed.success) {
    applyIssues(parsed.error.issues)
    await focusFirstError()
    return
  }

  const fingerprint = JSON.stringify([
    parsed.data.recipientEmail,
    parsed.data.subject,
    parsed.data.text,
  ])
  if (lastAttemptFingerprint.value && lastAttemptFingerprint.value !== fingerprint) {
    requestId.value = crypto.randomUUID()
  }
  lastAttemptFingerprint.value = fingerprint
  sending.value = true

  try {
    await send({
      recipientEmail: parsed.data.recipientEmail,
      subject: parsed.data.subject,
      text: parsed.data.text,
      requestId: requestId.value,
    })
    accepted.value = true
    notice.value = { kind: 'success', message: 'Email accepted for delivery.' }
  }
  catch (error: unknown) {
    const normalized = toErrorLike(error)
    notice.value = {
      kind: 'error',
      message: normalized.data?.message ?? normalized.message ?? 'Could not send the email. The draft was preserved.',
    }
  }
  finally {
    sending.value = false
  }
}

function startAnother(): void {
  for (const key of Object.keys(context) as ContextField[]) context[key] = ''
  subject.value = ''
  text.value = ''
  draftSignature.value = ''
  lastAttemptFingerprint.value = ''
  requestId.value = crypto.randomUUID()
  accepted.value = false
  clearErrors()
}
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <NuxtLink
      to="/admin"
      class="inline-flex items-center gap-2 rounded-md text-sm font-medium text-brand-muted outline-none transition hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-brand-accent/60 focus-visible:ring-offset-4 focus-visible:ring-offset-brand-bg"
    >
      <ArrowLeft class="size-4" />
      Admin dashboard
    </NuxtLink>

    <header class="mt-8 max-w-3xl">
      <p class="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-brand-accent">Founder tool</p>
      <h1 class="mt-3 text-3xl font-semibold tracking-tight text-brand-fg sm:text-4xl">Send one outreach email</h1>
      <p class="mt-3 text-sm leading-6 text-brand-muted sm:text-base">
        Add the recipient and product context, review the plain-text draft, then send it once.
      </p>
    </header>

    <form class="mt-8 grid items-start gap-5 lg:grid-cols-[0.82fr_1.18fr]" novalidate @submit.prevent="sendEmail">
      <section class="space-y-5 rounded-2xl border border-brand-border bg-white/[0.035] p-5 sm:p-6" aria-labelledby="context-heading">
        <div class="border-b border-white/[0.07] pb-4">
          <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-muted">Context</p>
          <h2 id="context-heading" class="mt-1 text-lg font-semibold text-brand-fg">Recipient and product</h2>
        </div>

        <div>
          <Label for="outreach-recipient" class="text-brand-fg">Recipient email <span class="text-brand-accent">*</span></Label>
          <Input
            id="outreach-recipient"
            v-model="context.recipientEmail"
            type="email"
            autocomplete="off"
            :class="inputClass"
            placeholder="founder@example.com"
            :disabled="accepted || sending"
            :aria-invalid="contextErrors.recipientEmail ? 'true' : undefined"
            aria-describedby="outreach-recipient-message"
          />
          <FieldMessage id="outreach-recipient-message" :error="contextErrors.recipientEmail" hint="Public business address selected by you." />
        </div>

        <div>
          <Label for="outreach-product" class="text-brand-fg">Product or app <span class="text-brand-accent">*</span></Label>
          <Input
            id="outreach-product"
            v-model="context.productName"
            :class="inputClass"
            placeholder="ShipFast"
            :disabled="accepted || sending"
            :aria-invalid="contextErrors.productName ? 'true' : undefined"
            aria-describedby="outreach-product-message"
          />
          <FieldMessage id="outreach-product-message" :error="contextErrors.productName" hint="Exact name used in the email." />
        </div>

        <div>
          <Label for="outreach-source" class="text-brand-fg">Found on <span class="text-brand-accent">*</span></Label>
          <Input
            id="outreach-source"
            v-model="context.sourceName"
            :class="inputClass"
            placeholder="Product Hunt"
            :disabled="accepted || sending"
            :aria-invalid="contextErrors.sourceName ? 'true' : undefined"
            aria-describedby="outreach-source-message"
          />
          <FieldMessage id="outreach-source-message" :error="contextErrors.sourceName" hint="Platform or public source name." />
        </div>

        <div>
          <Label for="outreach-first-name" class="text-brand-fg">First name <span class="font-normal text-brand-muted">— optional</span></Label>
          <Input
            id="outreach-first-name"
            v-model="context.firstName"
            :class="inputClass"
            placeholder="Maya"
            :disabled="accepted || sending"
            :aria-invalid="contextErrors.firstName ? 'true' : undefined"
            aria-describedby="outreach-first-name-message"
          />
          <FieldMessage id="outreach-first-name-message" :error="contextErrors.firstName" hint="Empty becomes “Hi,”." />
        </div>

        <div>
          <Label for="outreach-preview-url" class="text-brand-fg">Private preview URL <span class="font-normal text-brand-muted">— optional</span></Label>
          <Input
            id="outreach-preview-url"
            v-model="context.previewUrl"
            type="url"
            :class="[inputClass, 'font-mono text-xs']"
            placeholder="https://launchlog.ai/preview/…"
            :disabled="accepted || sending"
            :aria-invalid="contextErrors.previewUrl ? 'true' : undefined"
            aria-describedby="outreach-preview-url-message"
          />
          <FieldMessage id="outreach-preview-url-message" :error="contextErrors.previewUrl" hint="Existing clean LaunchLog preview link." :lines="2" />
        </div>

        <Button
          type="button"
          variant="outline"
          class="w-full border-white/10 bg-white/[0.04] text-brand-fg hover:border-white/20 hover:bg-white/[0.08] focus-visible:border-brand-accent/70 focus-visible:ring-brand-accent/30"
          :disabled="accepted || sending"
          @click="createDraft"
        >
          <Sparkles class="size-4" />
          Create draft
        </Button>
      </section>

      <section class="rounded-2xl border border-brand-border bg-[#0D1220] p-5 sm:p-6 lg:sticky lg:top-24" aria-labelledby="draft-heading">
        <div class="border-b border-white/[0.07] pb-4">
          <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-muted">Review</p>
          <h2 id="draft-heading" class="mt-1 text-lg font-semibold text-brand-fg">Editable email</h2>
        </div>

        <div class="mt-5 space-y-5">
          <div>
            <Label for="outreach-subject" class="text-brand-fg">Subject</Label>
            <Input
              id="outreach-subject"
              v-model="subject"
              :class="inputClass"
              placeholder="Create the draft first"
              :disabled="accepted || sending"
              :aria-invalid="draftErrors.subject ? 'true' : undefined"
              aria-describedby="outreach-subject-message"
            />
            <FieldMessage id="outreach-subject-message" :error="draftErrors.subject" hint="Editable, one line, maximum 200 characters." />
          </div>

          <div>
            <Label for="outreach-text" class="text-brand-fg">Message</Label>
            <textarea
              id="outreach-text"
              v-model="text"
              rows="16"
              class="mt-2 min-h-80 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 font-mono text-[13px] leading-6 text-brand-fg outline-none transition placeholder:text-brand-muted hover:border-white/20 focus-visible:border-brand-accent/70 focus-visible:ring-2 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Create the draft first"
              :disabled="accepted || sending"
              :aria-invalid="draftErrors.text ? 'true' : undefined"
              aria-describedby="outreach-text-message"
            />
            <FieldMessage id="outreach-text-message" :error="draftErrors.text" hint="Plain text only; maximum 5,000 characters." />
          </div>
        </div>

        <p v-if="draftIsStale" class="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200" role="status">
          Context changed. Create the draft again before sending.
        </p>
        <p
          v-if="notice"
          class="mt-4 rounded-lg border px-3 py-2 text-sm"
          :class="notice.kind === 'success'
            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
            : 'border-red-400/25 bg-red-400/10 text-red-200'"
          :role="notice.kind === 'error' ? 'alert' : 'status'"
          aria-live="polite"
        >
          <Check v-if="notice.kind === 'success'" class="mr-1.5 inline size-4" />
          {{ notice.message }}
        </p>

        <div class="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            size="lg"
            class="bg-brand-accent text-white hover:bg-brand-accent/85 focus-visible:border-brand-accent focus-visible:ring-brand-accent/40"
            :disabled="sendDisabled"
          >
            <LoaderCircle v-if="sending" class="size-4 animate-spin" />
            <Send v-else class="size-4" />
            {{ sending ? 'Sending…' : accepted ? 'Sent' : 'Send email' }}
          </Button>
          <Button
            v-if="accepted"
            type="button"
            size="lg"
            variant="outline"
            class="border-white/10 bg-white/[0.04] text-brand-fg hover:bg-white/[0.08]"
            @click="startAnother"
          >
            <RotateCcw class="size-4" />
            Start another email
          </Button>
        </div>
      </section>
    </form>
  </main>
</template>
