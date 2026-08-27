<script setup lang="ts">
import type { LabelProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { Label } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<LabelProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
</script>

<template>
  <Label
    data-slot="label"
    v-bind="delegatedProps"
    :class="
      cn(
        'flex select-none items-center gap-2 font-mono text-[0.68rem] font-semibold leading-none tracking-[0.12em] text-release-paper-muted uppercase group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-45 peer-disabled:cursor-not-allowed peer-disabled:opacity-45',
        props.class,
      )
    "
  >
    <slot />
  </Label>
</template>
