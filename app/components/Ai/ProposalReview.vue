<script setup lang="ts">
import { Check, ChevronDown, FileDiff, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { AiEnrichmentField, AiEnrichmentPayload } from '~/composables/useAiEnrichment'
import { aiFieldDisplayValue, aiFieldLinks, changedAiFields } from '~/utils/ai-enrichment-review'

const props = withDefaults(defineProps<{
  current: AiEnrichmentPayload
  proposed: AiEnrichmentPayload
  evidence?: Record<string, unknown>
  allowedFields?: AiEnrichmentField[]
  mode?: 'owner' | 'admin'
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

</script>

<template>
  <section class="overflow-hidden border border-release-seam bg-release-rail">
    <header class="border-b border-release-seam px-4 py-4 sm:px-5">
      <div class="flex min-w-0 items-start gap-3">
        <span class="inline-flex size-9 shrink-0 items-center justify-center border border-release-warning bg-release-warning text-release-ink">
          <FileDiff class="size-4" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <p class="font-mono text-[0.65rem] font-semibold tracking-[0.17em] text-release-warning uppercase">Grounded edit proof</p>
          <h3 class="mt-0.5 text-base font-semibold text-[#f6f1e7]">Review changes before publishing</h3>
          <p class="mt-1 max-w-2xl text-sm leading-5 text-release-paper-muted">
            Grounded in {{ evidenceSummary }}. Selected fields publish immediately.
          </p>
        </div>
      </div>
    </header>

    <div v-if="changedFields.length" class="divide-y divide-release-seam">
      <article v-for="field in changedFields" :key="field" class="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] lg:gap-4">
        <button
          type="button"
          role="checkbox"
          :aria-checked="selected.includes(field)"
          :disabled="busy || (field === 'category' && categoryNeedsApproval)"
          class="flex min-h-10 items-center gap-3 self-start text-left text-sm font-medium text-[#f6f1e7] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-release-warning disabled:cursor-not-allowed disabled:opacity-55"
          @click="toggle(field)"
        >
          <span
            class="inline-flex size-5 shrink-0 items-center justify-center border transition-colors"
            :class="selected.includes(field) ? 'border-release-blaze bg-release-blaze text-release-ink' : 'border-release-seam bg-release-ink text-transparent'"
          >
            <Check class="size-3.5" aria-hidden="true" />
          </span>
          {{ labels[field] }}
        </button>

        <div class="border border-release-seam bg-release-ink p-3.5">
          <p class="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-release-paper-muted">Current</p>
          <img v-if="field === 'logo_url' && aiFieldLinks(current, field)[0]" :src="aiFieldLinks(current, field)[0]" alt="Current listing logo" class="mt-3 size-14 border border-release-seam bg-release-rail object-contain p-1.5">
          <div v-if="field === 'social_links' && aiFieldLinks(current, field).length" class="mt-2 space-y-1.5">
            <a v-for="url in aiFieldLinks(current, field)" :key="url" :href="url" target="_blank" rel="noopener noreferrer" class="block break-all text-sm leading-5 text-release-paper-muted underline decoration-release-seam underline-offset-4 hover:text-release-paper">{{ url }}</a>
          </div>
          <a v-else-if="field === 'logo_url' && aiFieldLinks(current, field)[0]" :href="aiFieldLinks(current, field)[0]" target="_blank" rel="noopener noreferrer" class="mt-2 block break-all text-xs leading-5 text-release-paper-muted underline decoration-release-seam underline-offset-4 hover:text-release-paper">{{ aiFieldLinks(current, field)[0] }}</a>
          <p v-else class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-release-paper-muted">{{ aiFieldDisplayValue(current, field) }}</p>
        </div>
        <div class="border border-release-warning/50 bg-release-warning/[0.04] p-3.5">
          <p class="font-mono text-[0.62rem] font-semibold tracking-[0.16em] text-release-warning uppercase">Proposed</p>
          <img v-if="field === 'logo_url' && aiFieldLinks(proposed, field)[0]" :src="aiFieldLinks(proposed, field)[0]" alt="Proposed listing logo" class="mt-3 size-14 border border-release-warning/40 bg-release-rail object-contain p-1.5">
          <div v-if="field === 'social_links' && aiFieldLinks(proposed, field).length" class="mt-2 space-y-1.5">
            <a v-for="url in aiFieldLinks(proposed, field)" :key="url" :href="url" target="_blank" rel="noopener noreferrer" class="block break-all text-sm leading-5 text-[#f6f1e7] underline decoration-release-warning/50 underline-offset-4 hover:text-release-warning">{{ url }}</a>
          </div>
          <a v-else-if="field === 'logo_url' && aiFieldLinks(proposed, field)[0]" :href="aiFieldLinks(proposed, field)[0]" target="_blank" rel="noopener noreferrer" class="mt-2 block break-all text-xs leading-5 text-[#f6f1e7] underline decoration-release-warning/50 underline-offset-4 hover:text-release-warning">{{ aiFieldLinks(proposed, field)[0] }}</a>
          <p v-else class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-release-paper">{{ aiFieldDisplayValue(proposed, field) }}</p>
          <div v-if="field === 'category' && categoryNeedsApproval" class="mt-3 border border-release-warning/40 bg-release-warning/[0.07] px-3 py-2 text-xs leading-5 text-release-warning">
            This is a new category proposal. An admin must approve it before it can be applied.
            <button
              v-if="mode === 'admin'"
              type="button"
              class="ml-1 font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning/60"
              :disabled="busy"
              @click="emit('approveCategory')"
            >Approve category</button>
          </div>
        </div>
      </article>
    </div>
    <div v-else class="px-5 py-8 text-center">
      <p class="font-medium text-release-paper">The current listing already matches the grounded draft.</p>
      <p class="mt-1 text-sm text-release-paper-muted">No field changes were proposed.</p>
    </div>

    <div class="border-t border-release-seam bg-release-rail px-4 py-3 sm:px-5">
      <button
        type="button"
        class="flex w-full items-center justify-between py-1 text-left text-xs font-medium text-release-paper-muted outline-none transition-colors hover:text-release-paper focus-visible:ring-2 focus-visible:ring-release-warning"
        :aria-expanded="evidenceOpen"
        @click="evidenceOpen = !evidenceOpen"
      >
        <span>Evidence used: {{ evidenceSummary }}</span>
        <ChevronDown class="size-4 transition-transform" :class="evidenceOpen ? 'rotate-180' : ''" aria-hidden="true" />
      </button>
      <div v-if="evidenceOpen" class="mt-3 grid gap-3 text-xs leading-5 text-release-paper-muted sm:grid-cols-2">
        <div v-if="evidenceExcerpt('visible_text')" class="border border-release-seam bg-release-ink p-3"><span class="font-semibold text-release-paper">Homepage</span><p class="mt-1">{{ evidenceExcerpt('visible_text') }}</p></div>
        <div v-if="evidenceExcerpt('about_text')" class="border border-release-seam bg-release-ink p-3"><span class="font-semibold text-release-paper">About</span><p class="mt-1">{{ evidenceExcerpt('about_text') }}</p></div>
        <div v-if="evidenceExcerpt('json_ld_facts')" class="border border-release-seam bg-release-ink p-3"><span class="font-semibold text-release-paper">Structured data</span><p class="mt-1">{{ evidenceExcerpt('json_ld_facts') }}</p></div>
      </div>
    </div>

    <div data-ai-review-actions class="flex flex-col-reverse gap-2 border-t border-release-seam bg-release-ink px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-5">
      <Button type="button" variant="ghost" size="sm" class="rounded-none border border-transparent font-mono text-xs text-release-paper-muted hover:border-release-seam hover:bg-release-rail hover:text-release-paper" :disabled="busy" @click="emit('reject')">
        <RotateCcw class="mr-1.5 size-3.5" aria-hidden="true" /> Keep current
      </Button>
      <Button type="button" size="sm" class="rounded-none border border-release-paper bg-release-paper font-mono text-xs text-release-ink hover:border-release-warning hover:bg-release-warning" :disabled="busy || selected.length === 0" @click="emit('apply', selected)">
        <AppSpinner v-if="busy" class="mr-2" color="text-current" label="Applying selected suggestions" />
        {{ busy ? 'Applying…' : 'Apply & save selected changes' }}
      </Button>
    </div>

  </section>
</template>
