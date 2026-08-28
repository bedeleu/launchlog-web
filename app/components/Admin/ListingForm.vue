<script setup lang="ts">
import { Check, ChevronDown, ExternalLink, FileText, ImageOff } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { AdminCategory, AdminListing } from '~/composables/useAdminListings'
import { buildAdminListingUpdate, isAdminListingDirty } from '~/utils/admin-listing-editor'

const props = withDefaults(defineProps<{
  initial?: Partial<AdminListing>
  categories?: AdminCategory[]
  submitting?: boolean
  submitLabel?: string
}>(), {
  initial: () => ({}),
  categories: () => [],
  submitting: false,
  submitLabel: 'Save',
})

const emit = defineEmits<{ submit: [payload: Record<string, unknown>] }>()

const form = reactive({
  name: props.initial?.name ?? '',
  tagline: props.initial?.tagline ?? '',
  description: props.initial?.description ?? '',
  primary_category_id: props.initial?.primary_category_id ?? '',
  country: props.initial?.country ?? '',
  tier: props.initial?.tier ?? '',
})

const inputClass = 'w-full border border-release-seam bg-release-ink px-3.5 py-2.5 text-sm text-release-paper outline-none transition-colors placeholder:text-release-paper-muted hover:border-release-paper-muted focus-visible:border-release-warning focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50'
const statusLabel = computed(() => (props.initial?.status ?? 'draft').replaceAll('_', ' '))
const sourceLabel = computed(() => (props.initial?.source ?? 'admin').replaceAll('_', ' '))
const isDirty = computed(() => isAdminListingDirty(props.initial, form))

function onSubmit() {
  if (props.submitting || !isDirty.value) return
  emit('submit', buildAdminListingUpdate(form))
}
</script>

<template>
  <form class="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.55fr)] xl:items-start" @submit.prevent="onSubmit">
    <section aria-labelledby="public-content-heading" class="min-w-0">
      <div class="flex items-start gap-3 border-b border-release-seam pb-5">
        <span class="mt-0.5 grid size-9 shrink-0 place-items-center border border-release-warning bg-release-warning text-release-ink">
          <FileText class="size-4" aria-hidden="true" />
        </span>
        <div>
          <p class="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-release-warning">Editable catalog copy</p>
          <h2 id="public-content-heading" class="mt-1 text-base font-semibold text-release-paper">
            Public content
          </h2>
          <p class="mt-1 text-sm leading-6 text-release-paper-muted">
            Generated from the website. Correct only what visitors should see.
          </p>
        </div>
      </div>

      <div class="mt-6 grid gap-5">
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-release-paper">Name</span>
          <input v-model="form.name" required maxlength="120" type="text" :class="inputClass" autocomplete="off">
        </label>

        <label class="grid gap-2 text-sm">
          <span class="flex items-center justify-between gap-3">
            <span class="font-medium text-release-paper">Tagline</span>
            <span class="font-mono text-[11px] text-release-paper-muted">{{ form.tagline.length }}/200</span>
          </span>
          <input v-model="form.tagline" maxlength="200" type="text" :class="inputClass" placeholder="A concise one-line description">
        </label>

        <label class="grid gap-2 text-sm">
          <span class="flex items-center justify-between gap-3">
            <span class="font-medium text-release-paper">Description</span>
            <span class="font-mono text-[11px] text-release-paper-muted">{{ form.description.length }}/2000</span>
          </span>
          <textarea v-model="form.description" maxlength="2000" rows="6" :class="`${inputClass} min-h-36 resize-y leading-6`" placeholder="What the product does and who it is for" />
        </label>

        <div class="grid gap-5 sm:grid-cols-2">
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-release-paper">Category</span>
            <span class="relative">
              <select v-model="form.primary_category_id" :class="`${inputClass} appearance-none pr-9`">
                <option value="">Uncategorized</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
              <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-release-paper-muted" aria-hidden="true" />
            </span>
            <span class="text-xs leading-5 text-release-paper-muted">The grounded draft selects from the existing taxonomy; override only when needed.</span>
          </label>

          <label class="grid gap-2 self-start text-sm">
            <span class="font-medium text-release-paper">Country</span>
            <input v-model="form.country" maxlength="2" type="text" :class="`${inputClass} uppercase`" placeholder="US" autocomplete="country-code">
            <span class="text-xs leading-5 text-release-paper-muted">Optional two-letter country code.</span>
          </label>
        </div>

        <fieldset class="grid gap-3 border-t border-release-seam pt-5">
          <legend class="text-sm font-medium text-release-paper">Directory placement</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="cursor-pointer border p-4 transition-colors focus-within:ring-2 focus-within:ring-release-focus" :class="form.tier === 'basic' ? 'border-release-warning bg-release-warning/[0.06]' : 'border-release-seam bg-release-rail hover:border-release-paper-muted'">
              <span class="flex items-center gap-3">
                <input v-model="form.tier" value="basic" type="radio" class="peer sr-only">
                <span
                  aria-hidden="true"
                  class="grid size-4 shrink-0 place-items-center border transition-colors"
                  :class="form.tier === 'basic' ? 'border-release-blaze bg-release-blaze text-release-ink' : 'border-release-paper-muted bg-release-ink'"
                >
                  <Check v-if="form.tier === 'basic'" class="size-3" :stroke-width="3" />
                </span>
                <span>
                  <span class="block text-sm font-semibold text-release-paper">Standard</span>
                  <span class="mt-0.5 block text-xs text-release-paper-muted">Full directory listing</span>
                </span>
              </span>
            </label>
            <label class="cursor-pointer border p-4 transition-colors focus-within:ring-2 focus-within:ring-release-focus" :class="form.tier === 'featured' ? 'border-release-warning bg-release-warning/[0.06]' : 'border-release-seam bg-release-rail hover:border-release-paper-muted'">
              <span class="flex items-center gap-3">
                <input v-model="form.tier" value="featured" type="radio" class="peer sr-only">
                <span
                  aria-hidden="true"
                  class="grid size-4 shrink-0 place-items-center border transition-colors"
                  :class="form.tier === 'featured' ? 'border-release-blaze bg-release-blaze text-release-ink' : 'border-release-paper-muted bg-release-ink'"
                >
                  <Check v-if="form.tier === 'featured'" class="size-3" :stroke-width="3" />
                </span>
                <span>
                  <span class="block text-sm font-semibold text-release-paper">Featured</span>
                  <span class="mt-0.5 block text-xs text-release-paper-muted">Priority placement</span>
                </span>
              </span>
            </label>
          </div>
          <p class="text-xs leading-5 text-release-paper-muted">
            Admin placements publish without checkout or a Stripe subscription.
          </p>
        </fieldset>
      </div>

      <div class="mt-7 flex flex-wrap items-center gap-3 border-t border-release-seam pt-6">
        <Button type="submit" class="rounded-none border border-release-paper bg-release-paper font-mono text-xs text-release-ink hover:border-release-warning hover:bg-release-warning" :disabled="submitting || !isDirty">
          <AppSpinner v-if="submitting" color="text-current" class="mr-1.5" />
          {{ submitLabel }}
        </Button>
        <slot name="actions" />
      </div>
    </section>

    <aside aria-labelledby="capture-heading" class="overflow-hidden border border-release-seam bg-release-rail xl:sticky xl:top-24">
      <div class="border-b border-release-seam px-4 py-3.5">
        <p class="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-release-warning">Read-only source</p>
        <h2 id="capture-heading" class="mt-1 text-sm font-semibold text-release-paper">
          Website and capture
        </h2>
        <p class="mt-1 text-xs leading-5 text-release-paper-muted">Captured by the same URL-first onboarding customers use.</p>
      </div>

      <div class="p-3">
        <div class="aspect-[16/10] overflow-hidden border border-release-seam bg-release-ink">
          <img v-if="initial.screenshot_url" :src="initial.screenshot_url" :alt="`${form.name || 'Listing'} website capture`" class="size-full object-cover object-top">
          <div v-else class="grid size-full place-items-center text-release-paper-muted">
            <ImageOff class="size-5" aria-hidden="true" />
            <span class="sr-only">No website capture available</span>
          </div>
        </div>
      </div>

      <div class="grid gap-4 border-t border-release-seam px-4 py-4 text-sm">
        <div class="min-w-0">
          <span class="block font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-release-paper-muted">Website</span>
          <a :href="initial.url" target="_blank" rel="noopener noreferrer" class="mt-1.5 flex min-w-0 items-center gap-1.5 text-release-warning hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning">
            <span class="truncate">{{ initial.url }}</span>
            <ExternalLink class="size-3.5 shrink-0" aria-hidden="true" />
          </a>
        </div>

        <dl class="grid grid-cols-2 gap-3 border-t border-release-seam pt-4">
          <div>
            <dt class="font-mono text-[11px] uppercase tracking-[0.14em] text-release-paper-muted">Source</dt>
            <dd class="mt-1 capitalize text-release-paper">{{ sourceLabel }}</dd>
          </div>
          <div>
            <dt class="font-mono text-[11px] uppercase tracking-[0.14em] text-release-paper-muted">Status</dt>
            <dd class="mt-1 capitalize text-release-paper">{{ statusLabel }}</dd>
          </div>
        </dl>
      </div>
    </aside>
  </form>
</template>
