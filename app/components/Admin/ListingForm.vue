<script setup lang="ts">
import { Button } from '@/components/ui/button'
import type { AdminListing } from '~/composables/useAdminListings'

const props = withDefaults(defineProps<{
  initial?: Partial<AdminListing>
  submitting?: boolean
  submitLabel?: string
}>(), {
  submitting: false,
  submitLabel: 'Save',
})

const emit = defineEmits<{ submit: [payload: Record<string, unknown>] }>()

const form = reactive({
  name: props.initial?.name ?? '',
  url: props.initial?.url ?? '',
  tagline: props.initial?.tagline ?? '',
  description: props.initial?.description ?? '',
  link_text: props.initial?.link_text ?? '',
  screenshot_url: props.initial?.screenshot_url ?? '',
  tier: props.initial?.tier ?? '',
  source: props.initial?.source ?? 'admin',
  status: props.initial?.status ?? 'draft',
  country: props.initial?.country ?? '',
})

const inputClass = 'w-full rounded-md border border-brand-border bg-transparent px-3 py-2 text-sm text-brand-fg placeholder:text-brand-muted/60 focus:border-brand-accent/60 focus:outline-none'

function onSubmit() {
  if (props.submitting) return

  // Drop empty optional strings so the API keeps nulls clean; name/url stay.
  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(form)) {
    if (v === '' && k !== 'name' && k !== 'url') continue
    payload[k] = v === '' ? null : v
  }
  emit('submit', payload)
}
</script>

<template>
  <form class="grid gap-5 md:grid-cols-2" @submit.prevent="onSubmit">
    <label class="flex flex-col gap-1.5 text-sm md:col-span-2">
      <span class="text-brand-muted">Name *</span>
      <input v-model="form.name" required type="text" :class="inputClass" placeholder="Product name">
    </label>

    <label class="flex flex-col gap-1.5 text-sm md:col-span-2">
      <span class="text-brand-muted">URL *</span>
      <input v-model="form.url" required type="url" :class="inputClass" placeholder="https://example.com">
    </label>

    <label class="flex flex-col gap-1.5 text-sm md:col-span-2">
      <span class="text-brand-muted">Tagline</span>
      <input v-model="form.tagline" type="text" :class="inputClass" placeholder="One-line pitch">
    </label>

    <label class="flex flex-col gap-1.5 text-sm md:col-span-2">
      <span class="text-brand-muted">Description</span>
      <textarea v-model="form.description" rows="4" :class="inputClass" placeholder="Longer description" />
    </label>

    <label class="flex flex-col gap-1.5 text-sm">
      <span class="text-brand-muted">Link text</span>
      <input v-model="form.link_text" type="text" :class="inputClass">
    </label>

    <label class="flex flex-col gap-1.5 text-sm">
      <span class="text-brand-muted">Country (2-letter)</span>
      <input v-model="form.country" type="text" maxlength="2" :class="inputClass" placeholder="US">
    </label>

    <label class="flex flex-col gap-1.5 text-sm md:col-span-2">
      <span class="text-brand-muted">Screenshot URL</span>
      <input v-model="form.screenshot_url" type="url" :class="inputClass" placeholder="https://cdn.launchlog.ai/…">
    </label>

    <label class="flex flex-col gap-1.5 text-sm">
      <span class="text-brand-muted">Tier</span>
      <select v-model="form.tier" :class="inputClass">
        <option value="">— none —</option>
        <option value="basic">Standard</option>
        <option value="featured">Featured</option>
      </select>
    </label>

    <label class="flex flex-col gap-1.5 text-sm">
      <span class="text-brand-muted">Source</span>
      <select v-model="form.source" :class="inputClass">
        <option value="admin">Admin</option>
        <option value="founding">Founding</option>
        <option value="customer">Customer</option>
        <option value="seed">Seed</option>
      </select>
    </label>

    <label class="flex flex-col gap-1.5 text-sm">
      <span class="text-brand-muted">Status</span>
      <select v-model="form.status" :class="inputClass">
        <option value="draft">Draft</option>
        <option value="pending_review">Pending review</option>
        <option value="published">Published</option>
        <option value="rejected">Rejected</option>
        <option value="archived">Archived</option>
      </select>
    </label>

    <div class="flex items-center gap-3 md:col-span-2">
      <Button type="submit" :disabled="submitting">
        <AppSpinner v-if="submitting" color="text-current" class="mr-1.5" />
        {{ submitLabel }}
      </Button>
      <slot name="actions" />
    </div>
  </form>
</template>
