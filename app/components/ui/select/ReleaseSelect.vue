<script setup lang="ts">
import { Check, ChevronDown } from '@lucide/vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import type { ReleaseSelectOption } from '.'

const props = withDefaults(defineProps<{
  modelValue?: string
  options: ReleaseSelectOption[]
  placeholder?: string
  label: string
  disabled?: boolean
  class?: HTMLAttributes['class']
}>(), {
  modelValue: '',
  placeholder: 'Select an option',
  disabled: false,
  class: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const highlighted = ref(0)
const listboxId = `release-select-${useId()}`
const selectedLabel = computed(() => props.options.find(option => option.value === props.modelValue)?.label)
const enabledIndexes = computed(() => props.options.flatMap((option, index) => option.disabled ? [] : [index]))

function openMenu(direction: 1 | -1 = 1) {
  if (props.disabled || props.options.length === 0) return
  const selectedIndex = props.options.findIndex(option => option.value === props.modelValue && !option.disabled)
  highlighted.value = selectedIndex >= 0
    ? selectedIndex
    : direction === 1 ? (enabledIndexes.value[0] ?? 0) : (enabledIndexes.value.at(-1) ?? 0)
  open.value = true
}

function move(step: 1 | -1) {
  const indexes = enabledIndexes.value
  if (!indexes.length) return
  const current = indexes.indexOf(highlighted.value)
  const next = current < 0 ? 0 : (current + step + indexes.length) % indexes.length
  highlighted.value = indexes[next] ?? 0
}

function select(option: ReleaseSelectOption) {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openMenu(event.key === 'ArrowUp' ? -1 : 1)
    }
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
  }
  else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    highlighted.value = event.key === 'Home' ? (enabledIndexes.value[0] ?? 0) : (enabledIndexes.value.at(-1) ?? 0)
  }
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const option = props.options[highlighted.value]
    if (option) select(option)
  }
  else if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
  }
  else if (event.key === 'Tab') {
    open.value = false
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      role="combobox"
      :aria-label="label"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="listboxId"
      :aria-activedescendant="open ? `${listboxId}-option-${highlighted}` : undefined"
      :disabled="disabled"
      :class="cn('release-field flex h-10 w-full items-center justify-between gap-3 px-3 text-left text-sm outline-none transition-colors hover:border-release-paper-muted focus-visible:border-release-warning focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50', !selectedLabel && 'text-release-paper-muted', props.class)"
      @click="open ? open = false : openMenu()"
      @keydown="onKeydown"
    >
      <span class="truncate">{{ selectedLabel ?? placeholder }}</span>
      <ChevronDown class="size-4 shrink-0 text-release-paper-muted transition-transform" :class="open && 'rotate-180'" aria-hidden="true" />
    </button>

    <div
      v-if="open"
      :id="listboxId"
      role="listbox"
      :aria-label="label"
      class="release-select-overlay absolute left-0 top-[calc(100%+0.25rem)] z-[90] max-h-72 min-w-full overflow-auto border border-release-seam bg-release-ink p-1 text-release-paper shadow-[8px_8px_0_rgba(255,74,38,0.16)]"
    >
      <button
        v-for="(option, index) in options"
        :id="`${listboxId}-option-${index}`"
        :key="option.value"
        type="button"
        role="option"
        :aria-selected="option.value === modelValue"
        :disabled="option.disabled"
        class="relative flex min-h-10 w-full cursor-default items-center gap-2 px-9 py-2 text-left text-sm outline-none disabled:pointer-events-none disabled:opacity-45"
        :class="index === highlighted ? 'bg-release-warning text-release-ink' : 'bg-release-ink text-release-paper hover:bg-[#1a1c16]'"
        @pointerenter="!option.disabled && (highlighted = index)"
        @click="select(option)"
      >
        <Check v-if="option.value === modelValue" class="absolute left-3 size-3" :stroke-width="3" aria-hidden="true" />
        <span :class="option.value === modelValue && 'font-semibold'">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>
