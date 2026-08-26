<script setup lang="ts">
import { useForm } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { outreachCandidateCreateSchema } from '~/utils/outreach-form-schema'
import type { OutreachCandidateCreateInput } from '~/utils/outreach-form-schema'

const props = withDefaults(defineProps<{
  campaignKey: string
  submitting?: boolean
  backendErrors?: Record<string, string[]>
}>(), {
  submitting: false,
  backendErrors: () => ({}),
})

const emit = defineEmits<{
  submit: [payload: OutreachCandidateCreateInput]
}>()

const { setErrors } = useForm()
const form = reactive({
  company_name: '',
  product_name: '',
  product_url: '',
  founder_first_name: '',
  business_email: '',
  country_code: '',
  source_url: '',
  source_context: '',
  notes: '',
  source_attested: false,
})
const clientErrors = ref<Record<string, string>>({})

const fields = [
  { name: 'company_name', label: 'Company name', hint: 'The public company or maker name.', type: 'text' },
  { name: 'product_name', label: 'Product name', hint: 'The product name shown in its placement.', type: 'text' },
  { name: 'product_url', label: 'Product URL', hint: 'Immutable public product URL, including https://.', type: 'url' },
  { name: 'founder_first_name', label: 'Founder first name', hint: 'Optional public first name.', type: 'text' },
  { name: 'business_email', label: 'Business email', hint: 'Public business contact used only in the downloaded CSV.', type: 'email' },
  { name: 'country_code', label: 'Country', hint: 'Optional two-letter country code.', type: 'text' },
  { name: 'source_url', label: 'Public source URL', hint: 'A public page supporting this outreach record.', type: 'url' },
] as const

const inputClass = 'h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm text-brand-fg outline-none transition placeholder:text-brand-muted/50 hover:border-white/20 focus-visible:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-400/30'

function fieldError(name: keyof OutreachCandidateCreateInput): string | undefined {
  return props.backendErrors[name]?.[0] ?? clientErrors.value[name]
}

function onSubmit(): void {
  if (props.submitting) return
  clientErrors.value = {}
  const parsed = outreachCandidateCreateSchema.safeParse({ campaign_key: props.campaignKey, ...form })
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? '')
      if (field && errors[field] === undefined) errors[field] = issue.message
    }
    clientErrors.value = errors
    setErrors(errors)
    return
  }
  setErrors({})
  emit('submit', parsed.data)
}
</script>

<template>
  <form class="grid gap-5 sm:grid-cols-2" novalidate @submit.prevent="onSubmit">
    <div v-for="item in fields" :key="item.name" :class="item.name === 'source_url' ? 'sm:col-span-2' : ''">
      <label :for="item.name" class="text-sm font-medium text-brand-fg">{{ item.label }}</label>
      <input
        :id="item.name"
        v-model="form[item.name]"
        :name="item.name"
        :type="item.type"
        :disabled="submitting"
        :aria-invalid="fieldError(item.name) ? 'true' : 'false'"
        :aria-describedby="`${item.name}-description ${item.name}-error`"
        :class="inputClass"
      >
      <p :id="`${item.name}-description`" class="mt-1.5 text-xs leading-5 text-brand-muted">{{ item.hint }}</p>
      <p :id="`${item.name}-error`" :role="fieldError(item.name) ? 'alert' : undefined" class="min-h-5 text-xs leading-5 text-red-300">
        {{ fieldError(item.name) }}
      </p>
    </div>

    <div class="sm:col-span-2">
      <label for="source_context" class="text-sm font-medium text-brand-fg">Public source context</label>
      <textarea
        id="source_context"
        v-model="form.source_context"
        name="source_context"
        rows="3"
        :disabled="submitting"
        :aria-invalid="fieldError('source_context') ? 'true' : 'false'"
        aria-describedby="source_context-description source_context-error"
        :class="[inputClass, 'h-auto py-3']"
      />
      <p id="source_context-description" class="mt-1.5 text-xs leading-5 text-brand-muted">Briefly describe the public evidence.</p>
      <p id="source_context-error" :role="fieldError('source_context') ? 'alert' : undefined" class="min-h-5 text-xs leading-5 text-red-300">{{ fieldError('source_context') }}</p>
    </div>

    <div class="sm:col-span-2">
      <label for="notes" class="text-sm font-medium text-brand-fg">Notes</label>
      <textarea
        id="notes"
        v-model="form.notes"
        name="notes"
        rows="3"
        :disabled="submitting"
        :aria-invalid="fieldError('notes') ? 'true' : 'false'"
        aria-describedby="notes-description notes-error"
        :class="[inputClass, 'h-auto py-3']"
      />
      <p id="notes-description" class="mt-1.5 text-xs leading-5 text-brand-muted">Optional private reviewer context.</p>
      <p id="notes-error" :role="fieldError('notes') ? 'alert' : undefined" class="min-h-5 text-xs leading-5 text-red-300">{{ fieldError('notes') }}</p>
    </div>

    <div class="sm:col-span-2">
      <label for="source_attested" class="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.025] p-4 text-sm text-brand-fg transition hover:border-white/20 focus-within:border-brand-accent focus-within:ring-2 focus-within:ring-brand-accent/30">
        <input
          id="source_attested"
          v-model="form.source_attested"
          name="source_attested"
          type="checkbox"
          :disabled="submitting"
          :aria-invalid="fieldError('source_attested') ? 'true' : 'false'"
          aria-describedby="source_attested-description source_attested-error"
          class="peer sr-only"
        >
        <span
          aria-hidden="true"
          class="relative mt-0.5 size-5 shrink-0 rounded-md border border-white/25 bg-black/40 shadow-inner shadow-black/30 transition after:absolute after:left-[6px] after:top-[2px] after:h-3 after:w-1.5 after:rotate-45 after:border-b-2 after:border-r-2 after:border-white after:opacity-0 after:transition-opacity peer-checked:border-indigo-300 peer-checked:bg-indigo-500 peer-checked:shadow-indigo-500/30 peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#0a0e1a] peer-disabled:cursor-not-allowed peer-disabled:opacity-40"
        />
        <span>I confirm this evidence is public</span>
      </label>
      <p id="source_attested-description" class="mt-1.5 text-xs leading-5 text-brand-muted">Confirm only that the cited evidence is publicly accessible.</p>
      <p id="source_attested-error" :role="fieldError('source_attested') ? 'alert' : undefined" class="min-h-5 text-xs leading-5 text-red-300">{{ fieldError('source_attested') }}</p>
    </div>

    <div class="sm:col-span-2">
      <Button type="submit" :disabled="submitting || !campaignKey" class="min-w-44">
        <AppSpinner v-if="submitting" color="text-current" class="mr-2" />
        {{ submitting ? 'Creating candidate…' : 'Create candidate' }}
      </Button>
    </div>
  </form>
</template>
