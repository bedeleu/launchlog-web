<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { RefreshCw } from '@lucide/vue'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const { createPreview } = usePreviews()
const intake = useIntakeStore()

const submitting = ref(false)
const serverError = ref<string | null>(null)

const schema = toTypedSchema(
  z.object({
    url: z
      .string()
      .min(1, 'Enter your website URL')
      .url('Enter a valid URL')
      .refine(v => /^https?:\/\//i.test(v), 'URL must start with http:// or https://'),
  }),
)

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: schema,
  initialValues: {
    url: intake.lastUrl || '',
  },
})
const [url, urlAttrs] = defineField('url')

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true
  serverError.value = null
  intake.rememberSubmittedUrl(values.url)
  try {
    const reusable = intake.findReusableDraft(values.url)
    if (reusable) {
      await navigateTo(`/preview/${reusable.token}`)
      return
    }

    const preview = await createPreview(values.url)
    intake.rememberPreview(preview)
    await navigateTo(`/preview/${preview.token}`)
  }
  catch (e: unknown) {
    const err = e as { data?: { message?: string, errors?: Record<string, string[]> } }
    serverError.value
      = err?.data?.errors?.url?.[0]
        ?? err?.data?.message
        ?? 'We could not generate a preview for that URL. Please try another.'
  }
  finally {
    submitting.value = false
  }
})
</script>

<template>
  <form class="w-full max-w-xl" novalidate @submit="onSubmit">
    <label for="preview-url" class="block text-sm font-medium text-brand-fg">
      Website URL
    </label>
    <div class="mt-2 flex flex-col gap-3 sm:flex-row">
      <Input
        id="preview-url"
        v-model="url"
        v-bind="urlAttrs"
        type="url"
        inputmode="url"
        placeholder="https://yourproduct.com"
        autocomplete="url"
        :disabled="submitting"
        class="h-12 flex-1 text-base"
      />
      <Button type="submit" size="lg" class="h-12 px-6" :disabled="submitting">
        <RefreshCw v-if="submitting" class="size-4 animate-spin" />
        {{ submitting ? 'Generating preview…' : 'Preview my listing' }}
      </Button>
    </div>

    <FieldMessage
      class="mt-2"
      :error="errors.url ?? serverError"
      hint="Preview your listing for free. Pay only when you publish."
    />

    <p v-if="intake.latestDraft" class="mt-5 text-sm text-brand-muted">
      Already generated a preview?
      <NuxtLink :to="`/preview/${intake.latestDraft.token}`" class="text-brand-accent underline underline-offset-4">
        Resume {{ intake.latestDraft.domain }}
      </NuxtLink>
    </p>
  </form>
</template>
