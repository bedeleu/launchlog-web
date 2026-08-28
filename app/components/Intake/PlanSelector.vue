<script setup lang="ts">
import { Check } from '@lucide/vue'
import type { PlanTier } from '~/composables/usePlans'

withDefaults(defineProps<{ modelValue: PlanTier, disabled?: boolean, adminMode?: boolean }>(), {
  disabled: false,
  adminMode: false,
})
const emit = defineEmits<{ 'update:modelValue': [tier: PlanTier] }>()

const { plans } = usePlans()
</script>

<template>
  <div data-plan-selector class="space-y-2">
    <button
      v-for="plan in plans"
      :key="plan.tier"
      type="button"
      :aria-pressed="modelValue === plan.tier"
      :disabled="disabled"
      class="relative block w-full border px-4 py-4 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus focus-visible:ring-offset-2 focus-visible:ring-offset-release-ink disabled:cursor-not-allowed disabled:opacity-60"
      :class="modelValue === plan.tier
        ? 'border-release-paper bg-release-rail'
        : 'border-release-seam bg-release-ink hover:border-release-paper-muted'"
      @click="emit('update:modelValue', plan.tier)"
    >
      <div class="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="flex size-4 shrink-0 items-center justify-center border"
            :class="modelValue === plan.tier ? 'border-release-blaze bg-release-blaze text-release-ink' : 'border-release-paper-muted bg-release-ink'"
          >
            <Check v-if="modelValue === plan.tier" class="size-2.5" :stroke-width="3" />
          </span>
          <span class="whitespace-nowrap font-semibold text-release-paper">{{ plan.name }}</span>
          <span
            v-if="plan.badge"
            class="shrink-0 border border-release-seam px-2 py-0.5 font-mono text-[0.6rem] font-semibold tracking-[0.1em] text-release-paper-muted uppercase"
          >
            {{ plan.badge }}
          </span>
        </div>
        <div class="shrink-0 text-right">
          <template v-if="adminMode">
            <div class="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-release-signal">
              Manual placement
            </div>
            <div class="mt-0.5 text-[11px] text-release-paper-muted">
              No Stripe subscription
            </div>
          </template>
          <template v-else>
            <div class="font-semibold text-release-paper">
              {{ plan.monthlyLabel }}<span class="text-xs font-normal text-release-paper-muted">/mo</span>
            </div>
            <div class="text-[11px] text-release-paper-muted">
              {{ plan.priceLabel }} billed yearly
            </div>
          </template>
        </div>
      </div>

      <ul v-if="modelValue === plan.tier" class="mt-4 grid gap-x-4 border-t border-release-seam pt-3 text-sm text-release-paper-muted sm:grid-cols-2">
        <li v-for="f in plan.features" :key="f" class="flex items-start gap-2 py-1.5">
          <Check class="mt-0.5 size-3.5 shrink-0 text-release-signal" :stroke-width="2.5" />
          <span>{{ f }}</span>
        </li>
      </ul>
    </button>
  </div>
</template>
