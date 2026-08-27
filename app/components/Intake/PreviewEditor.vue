<script setup lang="ts">
import type { AiEnrichmentField, PreviewAiSuggestion } from '~/composables/useAiEnrichment'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

defineProps<{
  title: string
  tagline: string
  description: string
  open: boolean
  hasScreenshot: boolean
  recapturing: boolean
  recaptureError: string | null
  aiBusy: boolean
  aiError: string | null
  aiSuggestion: PreviewAiSuggestion | null
}>()

const emit = defineEmits<{
  'update:title': [value: string]
  'update:tagline': [value: string]
  'update:description': [value: string]
  'update:open': [value: boolean]
  'recapture': []
  'improve': []
  'apply': [fields: AiEnrichmentField[]]
  'reject': []
}>()
</script>

<template>
  <section data-preview-editor class="mt-4 border-t border-release-seam pt-4">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
      <button
        type="button"
        class="font-mono text-[0.65rem] font-semibold tracking-[0.08em] text-release-warning uppercase underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning"
        :aria-expanded="open"
        @click="emit('update:open', !open)"
      >
        {{ open ? 'Done editing text' : 'Edit listing text' }}
      </button>
      <button
        v-if="hasScreenshot"
        type="button"
        class="text-xs font-medium text-release-paper-muted underline decoration-release-seam underline-offset-4 transition-colors hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="recapturing"
        @click="emit('recapture')"
      >
        {{ recapturing ? 'Starting new capture…' : 'Screenshot not right? Capture again' }}
      </button>
      <button
        type="button"
        class="font-mono text-[0.65rem] font-semibold tracking-[0.08em] text-release-warning uppercase underline underline-offset-4 transition-colors hover:text-release-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-warning disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="aiBusy"
        @click="emit('improve')"
      >
        {{ aiBusy ? 'Preparing grounded draft…' : 'Improve draft with AI' }}
      </button>
    </div>

    <p v-if="recaptureError && hasScreenshot" class="mt-2 text-xs text-release-warning" role="alert">
      {{ recaptureError }}
    </p>

    <div v-show="open" class="mt-3 space-y-3 border border-release-seam bg-release-rail p-4">
      <div class="space-y-1.5">
        <Label for="f-title">Title</Label>
        <Input
          id="f-title"
          :model-value="title"
          placeholder="Your product name"
          @update:model-value="emit('update:title', String($event))"
        />
      </div>
      <div class="space-y-1.5">
        <Label for="f-tagline">Tagline</Label>
        <Input
          id="f-tagline"
          :model-value="tagline"
          placeholder="One line about what you do"
          @update:model-value="emit('update:tagline', String($event))"
        />
      </div>
      <div class="space-y-1.5">
        <Label for="f-description">Description</Label>
        <textarea
          id="f-description"
          :value="description"
          rows="4"
          placeholder="A short description of your product"
          style="field-sizing: content"
          class="max-h-60 min-h-20 w-full resize-none border border-release-seam bg-release-ink px-3 py-2 text-sm text-release-paper outline-none focus-visible:ring-2 focus-visible:ring-release-warning"
          @input="emit('update:description', ($event.target as HTMLTextAreaElement).value)"
        />
      </div>
    </div>

    <p v-if="aiError" class="mt-3 text-sm text-release-warning" role="alert">
      {{ aiError }}
    </p>

    <AiProposalReview
      v-if="aiSuggestion"
      class="mt-4"
      :current="aiSuggestion.current"
      :proposed="aiSuggestion.proposed"
      :evidence="aiSuggestion.evidence"
      :allowed-fields="['name', 'tagline', 'description', 'category']"
      mode="preview"
      :busy="aiBusy"
      @apply="emit('apply', $event)"
      @reject="emit('reject')"
    />
  </section>
</template>
