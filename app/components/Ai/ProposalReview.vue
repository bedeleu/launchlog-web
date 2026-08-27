<script setup lang="ts">
import { Check, ChevronDown, FileDiff, RotateCcw, ShieldCheck } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { AiEnrichmentField, AiEnrichmentPayload } from '~/composables/useAiEnrichment'
import { aiFieldDisplayValue, aiFieldLinks, changedAiFields } from '~/utils/ai-enrichment-review'

const props = withDefaults(defineProps<{
  current: AiEnrichmentPayload
  proposed: AiEnrichmentPayload
  evidence?: Record<string, unknown>
  allowedFields?: AiEnrichmentField[]
  mode?: 'preview' | 'owner' | 'admin'
  busy?: boolean
  categoryRequiresApproval?: boolean
}>(), {
  evidence: () => ({}),
  allowedFields: () => ['name', 'tagline', 'description', 'category', 'logo_url', 'social_links'],
  mode: 'owner',
  busy: false,
  categoryRequiresApproval: false,
})

const emit = defineEmits<{
  apply: [fields: AiEnrichmentField[]]
  reject: []
  approveCategory: []
}>()

const labels: Record<AiEnrichmentField, string> = {
  name: 'Name',
  tagline: 'Tagline',
  description: 'Description',
  category: 'Category',
  logo_url: 'Logo',
  social_links: 'Social links',
}

const changedFields = computed(() => changedAiFields(props.current, props.proposed, props.allowedFields))
const categoryNeedsApproval = computed(() => props.categoryRequiresApproval || props.proposed.category_requires_approval === true)
const selected = ref<AiEnrichmentField[]>([])
const evidenceOpen = ref(false)

const resetSelection = () => {
  selected.value = changedFields.value.filter(field => field !== 'category' || !categoryNeedsApproval.value)
}

watch(
  () => [props.current, props.proposed, props.allowedFields, props.proposed.category_requires_approval],
  resetSelection,
  { immediate: true, deep: true },
)

const toggle = (field: AiEnrichmentField) => {
  if (props.busy || (field === 'category' && categoryNeedsApproval.value)) return
  selected.value = selected.value.includes(field)
    ? selected.value.filter(item => item !== field)
    : [...selected.value, field]
}

const evidenceSummary = computed(() => {
  const value = props.evidence
  const sources = [
    value.visible_text ? 'homepage copy' : null,
    value.about_text ? 'About page' : null,
    value.json_ld_facts && typeof value.json_ld_facts === 'object' ? 'structured data' : null,
    value.screenshot_used ? 'screenshot' : null,
  ].filter(Boolean)
  return sources.length ? sources.join(', ') : 'sanitized website evidence'
})

const evidenceExcerpt = (key: string) => {
  const value = props.evidence[key]
  if (typeof value === 'string') return value.slice(0, 360)
  if (Array.isArray(value)) return value.slice(0, 6).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value).slice(0, 360)
  return null
}

const actionLabel = computed(() => {
  if (props.mode === 'preview') return 'Use selected suggestions'
  if (props.mode === 'admin') return 'Apply & save selected changes'
  return 'Update my listing'
})
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-brand-accent/30 bg-[linear-gradient(135deg,rgba(99,102,241,0.10),rgba(255,255,255,0.025)_58%,rgba(16,185,129,0.045))] shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
    <header class="flex flex-col gap-4 border-b border-brand-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex min-w-0 items-start gap-3">
        <span class="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/10 text-brand-accent">
          <FileDiff class="size-5" aria-hidden="true" />
        </span>
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">AI-assisted draft</p>
          <h3 class="mt-1 text-lg font-semibold text-brand-fg">Review every change before it is applied</h3>
          <p class="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
            Based on {{ evidenceSummary }}. Nothing changes until you confirm the selected fields.
          </p>
        </div>
      </div>
      <span class="inline-flex w-fit items-center gap-2 rounded-full border border-brand-success/25 bg-brand-success/[0.07] px-3 py-1.5 text-xs font-medium text-brand-success">
        <ShieldCheck class="size-3.5" aria-hidden="true" /> Human approval required
      </span>
    </header>

    <footer class="flex flex-col-reverse gap-3 border-b border-brand-border bg-black/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs leading-5 text-brand-muted">
        Selected fields are saved directly. No second save is needed.
      </p>
      <div class="flex flex-col-reverse gap-3 sm:flex-row">
        <Button type="button" variant="ghost" :disabled="busy" @click="emit('reject')">
          <RotateCcw class="mr-2 size-4" aria-hidden="true" /> Keep current version
        </Button>
        <Button type="button" :disabled="busy || selected.length === 0" @click="emit('apply', selected)">
          <AppSpinner v-if="busy" class="mr-2" color="text-current" label="Applying selected suggestions" />
          {{ busy ? 'Applying…' : actionLabel }}
        </Button>
      </div>
    </footer>

    <div v-if="changedFields.length" class="divide-y divide-brand-border">
      <article v-for="field in changedFields" :key="field" class="grid gap-3 px-5 py-4 lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] lg:gap-5">
        <button
          type="button"
          role="checkbox"
          :aria-checked="selected.includes(field)"
          :disabled="busy || (field === 'category' && categoryNeedsApproval)"
          class="flex min-h-10 items-center gap-3 self-start rounded-lg text-left text-sm font-medium text-brand-fg outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-brand-accent/60 disabled:cursor-not-allowed disabled:opacity-55"
          @click="toggle(field)"
        >
          <span
            class="inline-flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors"
            :class="selected.includes(field) ? 'border-brand-accent bg-brand-accent text-white' : 'border-white/20 bg-white/[0.02] text-transparent'"
          >
            <Check class="size-3.5" aria-hidden="true" />
          </span>
          {{ labels[field] }}
        </button>

        <div class="rounded-xl border border-brand-border bg-black/10 p-3.5">
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-muted">Current</p>
          <img v-if="field === 'logo_url' && aiFieldLinks(current, field)[0]" :src="aiFieldLinks(current, field)[0]" alt="Current listing logo" class="mt-3 size-14 rounded-xl border border-brand-border bg-white/5 object-contain p-1.5">
          <div v-if="field === 'social_links' && aiFieldLinks(current, field).length" class="mt-2 space-y-1.5">
            <a v-for="url in aiFieldLinks(current, field)" :key="url" :href="url" target="_blank" rel="noopener noreferrer" class="block break-all text-sm leading-5 text-brand-muted underline decoration-white/20 underline-offset-4 hover:text-brand-fg">{{ url }}</a>
          </div>
          <a v-else-if="field === 'logo_url' && aiFieldLinks(current, field)[0]" :href="aiFieldLinks(current, field)[0]" target="_blank" rel="noopener noreferrer" class="mt-2 block break-all text-xs leading-5 text-brand-muted underline decoration-white/20 underline-offset-4 hover:text-brand-fg">{{ aiFieldLinks(current, field)[0] }}</a>
          <p v-else class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-brand-muted">{{ aiFieldDisplayValue(current, field) }}</p>
        </div>
        <div class="rounded-xl border border-brand-accent/25 bg-brand-accent/[0.055] p-3.5">
          <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">Proposed</p>
          <img v-if="field === 'logo_url' && aiFieldLinks(proposed, field)[0]" :src="aiFieldLinks(proposed, field)[0]" alt="Proposed listing logo" class="mt-3 size-14 rounded-xl border border-brand-accent/25 bg-white/5 object-contain p-1.5">
          <div v-if="field === 'social_links' && aiFieldLinks(proposed, field).length" class="mt-2 space-y-1.5">
            <a v-for="url in aiFieldLinks(proposed, field)" :key="url" :href="url" target="_blank" rel="noopener noreferrer" class="block break-all text-sm leading-5 text-brand-fg underline decoration-brand-accent/35 underline-offset-4 hover:text-brand-accent">{{ url }}</a>
          </div>
          <a v-else-if="field === 'logo_url' && aiFieldLinks(proposed, field)[0]" :href="aiFieldLinks(proposed, field)[0]" target="_blank" rel="noopener noreferrer" class="mt-2 block break-all text-xs leading-5 text-brand-fg underline decoration-brand-accent/35 underline-offset-4 hover:text-brand-accent">{{ aiFieldLinks(proposed, field)[0] }}</a>
          <p v-else class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-brand-fg">{{ aiFieldDisplayValue(proposed, field) }}</p>
          <div v-if="field === 'category' && categoryNeedsApproval" class="mt-3 rounded-lg border border-brand-warning/30 bg-brand-warning/[0.07] px-3 py-2 text-xs leading-5 text-brand-warning">
            This is a new category proposal. An admin must approve it before it can be applied.
            <button
              v-if="mode === 'admin'"
              type="button"
              class="ml-1 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-warning/60"
              :disabled="busy"
              @click="emit('approveCategory')"
            >Approve category</button>
          </div>
        </div>
      </article>
    </div>
    <div v-else class="px-5 py-8 text-center">
      <p class="font-medium text-brand-fg">The current listing already matches the grounded draft.</p>
      <p class="mt-1 text-sm text-brand-muted">No field changes were proposed.</p>
    </div>

    <div class="border-t border-brand-border px-5 py-4">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-lg py-1 text-left text-xs font-medium text-brand-muted outline-none transition-colors hover:text-brand-fg focus-visible:ring-2 focus-visible:ring-brand-accent/60"
        :aria-expanded="evidenceOpen"
        @click="evidenceOpen = !evidenceOpen"
      >
        <span>Evidence used: {{ evidenceSummary }}</span>
        <ChevronDown class="size-4 transition-transform" :class="evidenceOpen ? 'rotate-180' : ''" aria-hidden="true" />
      </button>
      <div v-if="evidenceOpen" class="mt-3 grid gap-3 text-xs leading-5 text-brand-muted sm:grid-cols-2">
        <div v-if="evidenceExcerpt('visible_text')" class="rounded-lg border border-brand-border bg-black/10 p-3"><span class="font-semibold text-brand-fg">Homepage</span><p class="mt-1">{{ evidenceExcerpt('visible_text') }}</p></div>
        <div v-if="evidenceExcerpt('about_text')" class="rounded-lg border border-brand-border bg-black/10 p-3"><span class="font-semibold text-brand-fg">About</span><p class="mt-1">{{ evidenceExcerpt('about_text') }}</p></div>
        <div v-if="evidenceExcerpt('json_ld_facts')" class="rounded-lg border border-brand-border bg-black/10 p-3"><span class="font-semibold text-brand-fg">Structured data</span><p class="mt-1">{{ evidenceExcerpt('json_ld_facts') }}</p></div>
      </div>
    </div>

  </section>
</template>
