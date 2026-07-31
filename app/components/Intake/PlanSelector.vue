<script setup lang="ts">
import { Check } from '@lucide/vue'
import type { PlanTier } from '~/composables/usePlans'

withDefaults(defineProps<{ modelValue: PlanTier, disabled?: boolean }>(), {
  disabled: false,
})
const emit = defineEmits<{ 'update:modelValue': [tier: PlanTier] }>()

const { plans } = usePlans()
</script>

<template>
  <div class="space-y-2.5">
    <button
      v-for="plan in plans"
      :key="plan.tier"
      type="button"
      :aria-pressed="modelValue === plan.tier"
      :disabled="disabled"
      class="block w-full rounded-xl border p-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 disabled:cursor-not-allowed disabled:opacity-60"
      :class="modelValue === plan.tier
        ? (plan.highlight ? 'border-brand-accent bg-brand-accent/10' : 'border-brand-accent bg-brand-accent/5')
        : 'border-brand-border hover:border-brand-accent/40'"
      @click="emit('update:modelValue', plan.tier)"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="flex size-4 shrink-0 items-center justify-center rounded-full border"
            :class="modelValue === plan.tier ? 'border-brand-accent bg-brand-accent text-white' : 'border-brand-muted'"
          >
            <Check v-if="modelValue === plan.tier" class="size-2.5" :stroke-width="3" />
          </span>
          <span class="truncate font-semibold text-brand-fg">{{ plan.name }}</span>
          <span
            v-if="plan.badge"
            class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            :class="plan.highlight ? 'bg-brand-accent/20 text-brand-accent' : 'bg-white/10 text-brand-muted'"
          >
            {{ plan.badge }}
          </span>
        </div>
        <div class="shrink-0 text-right">
          <div class="font-semibold text-brand-fg">
            {{ plan.monthlyLabel }}<span class="text-xs font-normal text-brand-muted">/mo</span>
          </div>
          <div class="text-[11px] text-brand-muted">
            <span v-if="plan.compareAtLabel" class="mr-1 line-through">{{ plan.compareAtLabel }}</span>
            {{ plan.priceLabel }} billed yearly
          </div>
        </div>
      </div>

      <ul v-if="modelValue === plan.tier" class="mt-3 grid gap-1.5 text-sm text-brand-muted sm:grid-cols-2">
        <li v-for="f in plan.features" :key="f" class="flex items-center gap-1.5">
          <Check class="size-3.5 shrink-0 text-brand-accent" :stroke-width="2.5" />
          <span class="truncate">{{ f }}</span>
        </li>
      </ul>
    </button>
  </div>
</template>
