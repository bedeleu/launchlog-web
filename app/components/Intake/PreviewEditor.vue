<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PREVIEW_COPY_LIMITS } from '~/utils/preview-checkout'

const props = defineProps<{
  title: string
  domain: string
  tagline: string
  description: string
  open: boolean
  hasScreenshot: boolean
  recapturing: boolean
  recaptureError: string | null
}>()

const emit = defineEmits<{
  'update:title': [value: string]
  'update:tagline': [value: string]
  'update:description': [value: string]
  'update:open': [value: boolean]
  'recapture': []
}>()

const TITLE_LIMIT = PREVIEW_COPY_LIMITS.title
const TAGLINE_LIMIT = PREVIEW_COPY_LIMITS.tagline
const DESCRIPTION_LIMIT = PREVIEW_COPY_LIMITS.description

const titleError = computed(() => props.title.length > TITLE_LIMIT
  ? `Title must be ${TITLE_LIMIT} characters or fewer.`
  : null)
const taglineError = computed(() => props.tagline.length > TAGLINE_LIMIT
  ? `Tagline must be ${TAGLINE_LIMIT} characters or fewer.`
  : null)
const descriptionError = computed(() => props.description.length > DESCRIPTION_LIMIT
  ? `Description must be ${DESCRIPTION_LIMIT.toLocaleString('en')} characters or fewer.`
  : null)

const boundedValue = (value: unknown, limit: number) => String(value).slice(0, limit)
</script>

<template>
  <section data-preview-editor class="mt-4 border-y border-release-seam">
    <header class="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div class="min-w-0">
        <h2 class="text-base font-semibold tracking-[-0.02em] text-release-paper">
          Listing details
        </h2>
        <p class="mt-1 truncate text-sm font-medium text-release-paper">
          {{ title || domain }}
        </p>
        <p class="mt-1 flex min-w-0 items-center gap-2 text-xs text-release-paper-muted">
          <span class="max-w-[45%] truncate font-mono">{{ domain }}</span>
          <span v-if="tagline" aria-hidden="true" class="text-release-seam">/</span>
          <span v-if="tagline" class="truncate">{{ tagline }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2 sm:justify-end">
        <button
          id="preview-editor-toggle"
          type="button"
          class="inline-flex min-h-10 items-center border border-release-paper bg-release-paper px-3.5 font-mono text-[0.68rem] font-semibold tracking-[0.08em] text-release-ink uppercase transition-colors hover:border-release-warning hover:bg-release-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus"
          :aria-expanded="open"
          aria-controls="preview-editor-panel"
          @click="emit('update:open', !open)"
        >
          {{ open ? 'Close editor' : 'Edit details' }}
        </button>
        <button
          v-if="hasScreenshot"
          type="button"
          class="inline-flex min-h-10 items-center border border-release-seam px-3.5 font-mono text-[0.68rem] font-semibold tracking-[0.08em] text-release-paper-muted uppercase transition-colors hover:border-release-paper-muted hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="recapturing"
          @click="emit('recapture')"
        >
          {{ recapturing ? 'Starting capture…' : 'Capture again' }}
        </button>
      </div>
    </header>

    <p v-if="recaptureError && hasScreenshot" class="border-t border-release-seam py-3 text-sm text-release-warning" role="alert">
      {{ recaptureError }}
    </p>

    <div
      v-show="open"
      id="preview-editor-panel"
      class="space-y-5 border-t border-release-seam bg-release-rail p-4 sm:p-5"
      role="region"
      aria-labelledby="preview-editor-toggle"
    >
      <div class="space-y-1.5">
        <div class="flex items-center justify-between gap-4">
          <Label for="f-title">Title</Label>
          <span
            id="f-title-count"
            class="font-mono text-[0.65rem] tabular-nums"
            :class="titleError ? 'text-release-destructive' : 'text-release-paper-muted'"
          >{{ title.length }} / {{ TITLE_LIMIT }}</span>
        </div>
        <Input
          id="f-title"
          :model-value="title"
          :maxlength="TITLE_LIMIT"
          :aria-invalid="Boolean(titleError)"
          :aria-describedby="titleError ? 'f-title-count f-title-error' : 'f-title-count f-title-help'"
          placeholder="Your product name"
          @update:model-value="emit('update:title', boundedValue($event, TITLE_LIMIT))"
        />
        <p v-if="titleError" id="f-title-error" class="text-xs leading-5 text-release-destructive" role="alert">{{ titleError }}</p>
        <p v-else id="f-title-help" class="text-xs leading-5 text-release-paper-muted">The catalog name visitors scan first.</p>
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between gap-4">
          <Label for="f-tagline">Tagline</Label>
          <span
            id="f-tagline-count"
            class="font-mono text-[0.65rem] tabular-nums"
            :class="taglineError ? 'text-release-destructive' : 'text-release-paper-muted'"
          >{{ tagline.length }} / {{ TAGLINE_LIMIT }}</span>
        </div>
        <Input
          id="f-tagline"
          :model-value="tagline"
          :maxlength="TAGLINE_LIMIT"
          :aria-invalid="Boolean(taglineError)"
          :aria-describedby="taglineError ? 'f-tagline-count f-tagline-error' : 'f-tagline-count f-tagline-help'"
          placeholder="One line about what you do"
          @update:model-value="emit('update:tagline', boundedValue($event, TAGLINE_LIMIT))"
        />
        <p v-if="taglineError" id="f-tagline-error" class="text-xs leading-5 text-release-destructive" role="alert">{{ taglineError }}</p>
        <p v-else id="f-tagline-help" class="text-xs leading-5 text-release-paper-muted">Keep the promise specific enough to stand alone.</p>
      </div>
      <div class="space-y-1.5">
        <div class="flex items-center justify-between gap-4">
          <Label for="f-description">Description</Label>
          <span
            id="f-description-count"
            class="font-mono text-[0.65rem] tabular-nums"
            :class="descriptionError ? 'text-release-destructive' : 'text-release-paper-muted'"
          >{{ description.length }} / {{ DESCRIPTION_LIMIT.toLocaleString('en') }}</span>
        </div>
        <textarea
          id="f-description"
          :value="description"
          :maxlength="DESCRIPTION_LIMIT"
          :aria-invalid="Boolean(descriptionError)"
          :aria-describedby="descriptionError ? 'f-description-count f-description-error' : 'f-description-count f-description-help'"
          rows="4"
          placeholder="A short description of your product"
          style="field-sizing: content"
          class="max-h-60 min-h-20 w-full resize-none border border-release-seam bg-release-ink px-3 py-2 text-sm leading-6 text-release-paper outline-none transition-[border-color,box-shadow] placeholder:text-release-paper-muted focus-visible:border-release-warning focus-visible:ring-2 focus-visible:ring-release-focus aria-invalid:border-release-destructive aria-invalid:ring-release-destructive/30"
          @input="emit('update:description', boundedValue(($event.target as HTMLTextAreaElement).value, DESCRIPTION_LIMIT))"
        />
        <p v-if="descriptionError" id="f-description-error" class="text-xs leading-5 text-release-destructive" role="alert">{{ descriptionError }}</p>
        <p v-else id="f-description-help" class="text-xs leading-5 text-release-paper-muted">Summarize the product, audience, and concrete outcome.</p>
      </div>
    </div>
  </section>
</template>
