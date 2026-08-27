<script setup lang="ts">
import { ExternalLink, ImageOff, Sparkles } from '@lucide/vue'
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

const inputClass = 'w-full rounded-lg border border-brand-border bg-[#0D1220] px-3.5 py-2.5 text-sm text-brand-fg shadow-inner shadow-black/10 outline-none transition placeholder:text-brand-muted/60 hover:border-white/15 focus-visible:border-brand-accent focus-visible:ring-2 focus-visible:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-50'
const statusLabel = computed(() => (props.initial?.status ?? 'draft').replaceAll('_', ' '))
const sourceLabel = computed(() => (props.initial?.source ?? 'admin').replaceAll('_', ' '))
const isDirty = computed(() => isAdminListingDirty(props.initial, form))

function onSubmit() {
  if (props.submitting || !isDirty.value) return
  emit('submit', buildAdminListingUpdate(form))
}
</script>

<template>
  <form class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start" @submit.prevent="onSubmit">
    <section aria-labelledby="public-content-heading" class="min-w-0">
      <div class="flex items-start gap-3 border-b border-brand-border pb-5">
        <span class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
          <Sparkles class="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 id="public-content-heading" class="text-base font-semibold text-brand-fg">
            Public content
          </h2>
          <p class="mt-1 text-sm leading-6 text-brand-muted">
            Generated from the website. Correct only what visitors should see.
          </p>
        </div>
      </div>

      <div class="mt-6 grid gap-5">
        <label class="grid gap-2 text-sm">
          <span class="font-medium text-brand-fg">Name</span>
          <input v-model="form.name" required maxlength="120" type="text" :class="inputClass" autocomplete="off">
        </label>

        <label class="grid gap-2 text-sm">
          <span class="flex items-center justify-between gap-3">
            <span class="font-medium text-brand-fg">Tagline</span>
            <span class="font-mono text-[11px] text-brand-muted">{{ form.tagline.length }}/200</span>
          </span>
          <input v-model="form.tagline" maxlength="200" type="text" :class="inputClass" placeholder="A concise one-line description">
        </label>

        <label class="grid gap-2 text-sm">
          <span class="flex items-center justify-between gap-3">
            <span class="font-medium text-brand-fg">Description</span>
            <span class="font-mono text-[11px] text-brand-muted">{{ form.description.length }}/2000</span>
          </span>
          <textarea v-model="form.description" maxlength="2000" rows="6" :class="`${inputClass} min-h-36 resize-y leading-6`" placeholder="What the product does and who it is for" />
        </label>

        <div class="grid gap-5 sm:grid-cols-2">
          <label class="grid gap-2 text-sm">
            <span class="font-medium text-brand-fg">Category</span>
            <span class="relative">
              <select v-model="form.primary_category_id" :class="`${inputClass} appearance-none pr-9`">
                <option value="">Uncategorized</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
              <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-muted" aria-hidden="true">⌄</span>
            </span>
            <span class="text-xs leading-5 text-brand-muted">AI selects from the existing taxonomy; override only when needed.</span>
          </label>

          <label class="grid gap-2 self-start text-sm">
            <span class="font-medium text-brand-fg">Country</span>
            <input v-model="form.country" maxlength="2" type="text" :class="`${inputClass} uppercase`" placeholder="US" autocomplete="country-code">
            <span class="text-xs leading-5 text-brand-muted">Optional two-letter country code.</span>
          </label>
        </div>

        <fieldset class="grid gap-3 border-t border-brand-border pt-5">
          <legend class="text-sm font-medium text-brand-fg">Directory placement</legend>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-brand-accent/30" :class="form.tier === 'basic' ? 'border-brand-accent bg-brand-accent/8' : 'border-brand-border bg-white/[0.02] hover:border-white/15'">
              <span class="flex items-center gap-3">
                <input v-model="form.tier" value="basic" type="radio" class="size-4 accent-brand-accent">
                <span>
                  <span class="block text-sm font-semibold text-brand-fg">Standard</span>
                  <span class="mt-0.5 block text-xs text-brand-muted">Full directory listing</span>
                </span>
              </span>
            </label>
            <label class="cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-brand-accent/30" :class="form.tier === 'featured' ? 'border-brand-accent bg-brand-accent/8' : 'border-brand-border bg-white/[0.02] hover:border-white/15'">
              <span class="flex items-center gap-3">
                <input v-model="form.tier" value="featured" type="radio" class="size-4 accent-brand-accent">
                <span>
                  <span class="block text-sm font-semibold text-brand-fg">Featured</span>
                  <span class="mt-0.5 block text-xs text-brand-muted">Priority placement</span>
                </span>
              </span>
            </label>
          </div>
          <p class="text-xs leading-5 text-brand-muted">
            Admin placements publish without checkout or a Stripe subscription.
          </p>
        </fieldset>
      </div>

      <div class="mt-7 flex flex-wrap items-center gap-3 border-t border-brand-border pt-6">
        <Button type="submit" :disabled="submitting || !isDirty">
          <AppSpinner v-if="submitting" color="text-current" class="mr-1.5" />
          {{ submitLabel }}
        </Button>
        <slot name="actions" />
      </div>
    </section>

    <aside aria-labelledby="capture-heading" class="overflow-hidden rounded-xl border border-brand-border bg-white/[0.025] lg:sticky lg:top-24">
      <div class="border-b border-brand-border px-4 py-3.5">
        <h2 id="capture-heading" class="text-sm font-semibold text-brand-fg">
          Website and capture
        </h2>
        <p class="mt-1 text-xs leading-5 text-brand-muted">Read-only source data from onboarding.</p>
      </div>

      <div class="p-3">
        <div class="aspect-[16/10] overflow-hidden rounded-lg border border-brand-border bg-[#080C16]">
          <img v-if="initial.screenshot_url" :src="initial.screenshot_url" :alt="`${form.name || 'Listing'} website capture`" class="size-full object-cover object-top">
          <div v-else class="grid size-full place-items-center text-brand-muted">
            <ImageOff class="size-5" aria-hidden="true" />
            <span class="sr-only">No website capture available</span>
          </div>
        </div>
      </div>

      <div class="grid gap-4 border-t border-brand-border px-4 py-4 text-sm">
        <div class="min-w-0">
          <span class="block text-[11px] font-medium uppercase tracking-[0.16em] text-brand-muted">Website</span>
          <a :href="initial.url" target="_blank" rel="noopener noreferrer" class="mt-1.5 flex min-w-0 items-center gap-1.5 text-brand-accent hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/30">
            <span class="truncate">{{ initial.url }}</span>
            <ExternalLink class="size-3.5 shrink-0" aria-hidden="true" />
          </a>
        </div>

        <dl class="grid grid-cols-2 gap-3 border-t border-brand-border pt-4">
          <div>
            <dt class="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Source</dt>
            <dd class="mt-1 capitalize text-brand-fg">{{ sourceLabel }}</dd>
          </div>
          <div>
            <dt class="text-[11px] uppercase tracking-[0.14em] text-brand-muted">Status</dt>
            <dd class="mt-1 capitalize text-brand-fg">{{ statusLabel }}</dd>
          </div>
        </dl>
      </div>
    </aside>
  </form>
</template>
