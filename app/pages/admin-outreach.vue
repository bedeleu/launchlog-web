<script setup lang="ts">
import { ArrowLeft, Check, Copy, FileText, ShieldCheck, Sparkles } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { buildOutreachEmail, copyOutreachText, isSafePreviewUrl } from '~/utils/outreach-email'

definePageMeta({ path: '/admin/outreach', middleware: 'admin' })
useHead({
  title: 'Outreach email template · LaunchLog',
  meta: [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ],
})

const form = reactive({
  firstName: '',
  appName: '',
  sourceName: '',
  previewUrl: '',
})
const errors = reactive({
  appName: '',
  sourceName: '',
  previewUrl: '',
})
const subject = ref('')
const body = ref('')
const generatedSignature = ref('')
const generationNotice = ref('')
const copyNotice = ref<{ kind: 'success' | 'error', message: string } | null>(null)

const fieldClass = 'w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-brand-fg shadow-inner shadow-black/10 outline-none transition placeholder:text-brand-muted hover:border-white/20 focus-visible:border-brand-accent/70 focus-visible:ring-2 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-50'
const signature = computed(() => [
  form.firstName.trim(),
  form.appName.trim(),
  form.sourceName.trim(),
  form.previewUrl.trim(),
].join('\u001f'))
const hasDraft = computed(() => subject.value.trim() !== '' || body.value.trim() !== '')
const isDraftStale = computed(() => generatedSignature.value !== '' && generatedSignature.value !== signature.value)

function clearErrors(): void {
  errors.appName = ''
  errors.sourceName = ''
  errors.previewUrl = ''
}

async function generateEmail(): Promise<void> {
  clearErrors()
  generationNotice.value = ''
  copyNotice.value = null

  if (!form.appName.trim()) errors.appName = 'Enter the app or product name.'
  if (!form.sourceName.trim()) errors.sourceName = 'Enter where you found the product.'
  if (form.previewUrl.trim() && !isSafePreviewUrl(form.previewUrl)) {
    errors.previewUrl = 'Paste a valid LaunchLog private preview link.'
  }

  const firstInvalidId = errors.appName
    ? 'outreach-app-name'
    : errors.sourceName
      ? 'outreach-source-name'
      : errors.previewUrl
        ? 'outreach-preview-url'
        : null

  if (firstInvalidId) {
    await nextTick()
    document.getElementById(firstInvalidId)?.focus()
    return
  }

  const draft = buildOutreachEmail(form)
  subject.value = draft.subject
  body.value = draft.body
  generatedSignature.value = signature.value
  generationNotice.value = 'Template generated. You can edit the subject and message before copying.'
}

async function copyText(label: 'Subject' | 'Message', text: string): Promise<void> {
  copyNotice.value = null

  try {
    if (!navigator.clipboard) throw new Error('Clipboard unavailable')
    await copyOutreachText(text, navigator.clipboard)
    copyNotice.value = { kind: 'success', message: `${label} copied.` }
  }
  catch {
    copyNotice.value = {
      kind: 'error',
      message: `Could not copy the ${label.toLowerCase()}. Select it manually and copy it from the field.`,
    }
  }
}
</script>

<template>
  <div class="relative min-h-[calc(100vh-4rem)] overflow-hidden">
    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.13),transparent_56%)]" />

    <div class="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <NuxtLink
        to="/admin"
        class="inline-flex items-center gap-2 rounded-md text-sm font-medium text-brand-muted outline-none transition hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-brand-accent/60 focus-visible:ring-offset-4 focus-visible:ring-offset-brand-bg"
      >
        <ArrowLeft class="size-4" />
        Admin dashboard
      </NuxtLink>

      <header class="mt-8 max-w-3xl">
        <div class="flex flex-wrap items-center gap-3">
          <p class="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-brand-accent">
            Founder tool / 01
          </p>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <ShieldCheck class="size-3.5" />
            Nothing is sent or saved
          </span>
        </div>
        <h1 class="mt-4 text-3xl font-semibold tracking-tight text-brand-fg sm:text-4xl">
          Outreach email template
        </h1>
        <p class="mt-3 max-w-2xl text-sm leading-6 text-brand-muted sm:text-base">
          Add the product context, generate a short English email, edit anything you want, then copy it into your email tool.
        </p>
      </header>

      <div class="mt-9 grid items-start gap-5 lg:grid-cols-[0.82fr_1.18fr]">
        <section class="rounded-2xl border border-brand-border bg-white/[0.035] p-5 shadow-2xl shadow-black/10 sm:p-6" aria-labelledby="context-heading">
          <div class="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
            <div>
              <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-muted">Context</p>
              <h2 id="context-heading" class="mt-1 text-lg font-semibold text-brand-fg">What you know</h2>
            </div>
            <span class="rounded-md border border-white/10 bg-black/20 px-2 py-1 font-mono text-[11px] text-brand-muted">4 fields</span>
          </div>

          <form class="mt-5 space-y-5" autocomplete="off" novalidate @submit.prevent="generateEmail">
            <div>
              <label for="outreach-app-name" class="text-sm font-medium text-brand-fg">App or product name <span class="text-brand-accent">*</span></label>
              <p id="outreach-app-name-help" class="mt-1 text-xs leading-5 text-brand-muted">The exact name you want to mention.</p>
              <input
                id="outreach-app-name"
                v-model="form.appName"
                type="text"
                required
                :class="fieldClass"
                class="mt-2"
                placeholder="e.g. ShipFast"
                :aria-invalid="errors.appName ? 'true' : 'false'"
                :aria-describedby="errors.appName ? 'outreach-app-name-help outreach-app-name-error' : 'outreach-app-name-help'"
              >
              <p v-if="errors.appName" id="outreach-app-name-error" class="mt-2 text-xs text-red-300" role="alert">{{ errors.appName }}</p>
            </div>

            <div>
              <label for="outreach-source-name" class="text-sm font-medium text-brand-fg">Found on <span class="text-brand-accent">*</span></label>
              <p id="outreach-source-name-help" class="mt-1 text-xs leading-5 text-brand-muted">Platform or public source, such as Product Hunt.</p>
              <input
                id="outreach-source-name"
                v-model="form.sourceName"
                type="text"
                required
                :class="fieldClass"
                class="mt-2"
                placeholder="e.g. Product Hunt"
                :aria-invalid="errors.sourceName ? 'true' : 'false'"
                :aria-describedby="errors.sourceName ? 'outreach-source-name-help outreach-source-name-error' : 'outreach-source-name-help'"
              >
              <p v-if="errors.sourceName" id="outreach-source-name-error" class="mt-2 text-xs text-red-300" role="alert">{{ errors.sourceName }}</p>
            </div>

            <div>
              <label for="outreach-first-name" class="text-sm font-medium text-brand-fg">First name <span class="font-normal text-brand-muted">— optional</span></label>
              <p id="outreach-first-name-help" class="mt-1 text-xs leading-5 text-brand-muted">Leave empty for a neutral “Hi,” greeting.</p>
              <input
                id="outreach-first-name"
                v-model="form.firstName"
                type="text"
                :class="fieldClass"
                class="mt-2"
                placeholder="e.g. Maya"
                aria-describedby="outreach-first-name-help"
              >
            </div>

            <div>
              <label for="outreach-preview-url" class="text-sm font-medium text-brand-fg">Private preview link <span class="font-normal text-brand-muted">— optional</span></label>
              <p id="outreach-preview-url-help" class="mt-1 text-xs leading-5 text-brand-muted">A launchlog.ai/preview link. Leave empty to ask whether they want a preview.</p>
              <input
                id="outreach-preview-url"
                v-model="form.previewUrl"
                type="url"
                inputmode="url"
                :class="fieldClass"
                class="mt-2 font-mono text-xs"
                placeholder="https://launchlog.ai/preview/…"
                :aria-invalid="errors.previewUrl ? 'true' : 'false'"
                :aria-describedby="errors.previewUrl ? 'outreach-preview-url-help outreach-preview-url-error' : 'outreach-preview-url-help'"
              >
              <p v-if="errors.previewUrl" id="outreach-preview-url-error" class="mt-2 text-xs text-red-300" role="alert">{{ errors.previewUrl }}</p>
            </div>

            <Button type="submit" size="lg" class="w-full bg-brand-accent text-white hover:bg-brand-accent/85 focus-visible:border-brand-accent focus-visible:ring-brand-accent/40 sm:w-auto">
              <Sparkles class="size-4" />
              Generate email
            </Button>
          </form>
        </section>

        <section class="rounded-2xl border border-brand-border bg-[#0D1220] p-5 shadow-2xl shadow-black/20 sm:p-6 lg:sticky lg:top-24" aria-labelledby="draft-heading">
          <div class="flex flex-col gap-4 border-b border-white/[0.07] pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-brand-muted">Draft</p>
              <h2 id="draft-heading" class="mt-1 flex items-center gap-2 text-lg font-semibold text-brand-fg">
                <FileText class="size-4 text-brand-accent" />
                Email ready to edit
              </h2>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                :disabled="!subject.trim()"
                class="border-white/10 bg-white/[0.035] text-brand-fg hover:border-white/20 hover:bg-white/[0.07] hover:text-brand-fg focus-visible:border-brand-accent/70 focus-visible:ring-brand-accent/30 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-brand-fg"
                @click="copyText('Subject', subject)"
              >
                <Copy class="size-3.5" />
                Copy subject
              </Button>
              <Button
                type="button"
                variant="outline"
                :disabled="!body.trim()"
                class="border-white/10 bg-white/[0.035] text-brand-fg hover:border-white/20 hover:bg-white/[0.07] hover:text-brand-fg focus-visible:border-brand-accent/70 focus-visible:ring-brand-accent/30 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-brand-fg"
                @click="copyText('Message', body)"
              >
                <Copy class="size-3.5" />
                Copy message
              </Button>
            </div>
          </div>

          <div v-if="!hasDraft" class="mt-5 rounded-xl border border-dashed border-white/10 bg-black/15 px-5 py-12 text-center">
            <Sparkles class="mx-auto size-5 text-brand-muted" />
            <p class="mt-3 text-sm font-medium text-brand-fg">Your template will appear here</p>
            <p class="mt-1 text-xs leading-5 text-brand-muted">Fill the two required fields and generate the email.</p>
          </div>

          <div v-else class="mt-5 space-y-5">
            <div>
              <label for="outreach-subject" class="text-sm font-medium text-brand-fg">Subject</label>
              <input id="outreach-subject" v-model="subject" type="text" :class="fieldClass" class="mt-2" aria-describedby="outreach-subject-help">
              <p id="outreach-subject-help" class="mt-1.5 text-xs text-brand-muted">Editable before copying.</p>
            </div>
            <div>
              <label for="outreach-body" class="text-sm font-medium text-brand-fg">Message</label>
              <textarea id="outreach-body" v-model="body" rows="16" :class="fieldClass" class="mt-2 min-h-80 resize-y font-mono text-[13px] leading-6" aria-describedby="outreach-body-help" />
              <p id="outreach-body-help" class="mt-1.5 text-xs text-brand-muted">Plain text only. No attachment or tracking.</p>
            </div>
          </div>

          <p v-if="isDraftStale" class="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200" role="status">
            Context changed. Generate again when you want to replace the draft.
          </p>
          <p v-else-if="generationNotice" class="mt-4 flex items-start gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200" role="status">
            <Check class="mt-0.5 size-3.5 shrink-0" />
            {{ generationNotice }}
          </p>
          <p
            v-if="copyNotice"
            class="mt-3 rounded-lg border px-3 py-2 text-xs"
            :class="copyNotice.kind === 'success' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-red-400/25 bg-red-400/10 text-red-200'"
            :role="copyNotice.kind === 'error' ? 'alert' : 'status'"
            aria-live="polite"
          >
            {{ copyNotice.message }}
          </p>
        </section>
      </div>
    </div>
  </div>
</template>
