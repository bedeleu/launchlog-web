<script setup lang="ts">
import type { AdminEdition, AdminEditionCandidate, AdminEditionItemInput } from '~/composables/useAdminEditions'
import { toErrorLike } from '~/utils/error-like'

type Direction = 'up' | 'down'
type PendingAction = 'intro' | 'items' | 'publish' | 'visibility' | null
type EditableItem = AdminEditionItemInput & { snapshot_name: string, source: AdminEditionCandidate['source'] | 'unknown' }

const props = defineProps<{ edition: AdminEdition }>()
const emit = defineEmits<{ updated: [edition: AdminEdition] }>()
const editions = useAdminEditions()

const serverIntroduction = ref<string | null>(props.edition.introduction)
const serverItems = ref<EditableItem[]>([])
const introduction = ref(props.edition.introduction ?? '')
const draftItems = ref<EditableItem[]>([])
const pendingAction = ref<PendingAction>(null)
const pending = computed(() => pendingAction.value !== null)
const error = ref<string | null>(null)
const introductionError = ref<string | null>(null)
const message = ref('')
const confirmingPublication = ref(false)
const pendingItemId = ref<string | null>(null)
const controlRefs = new Map<string, HTMLElement>()
const itemValidationTouched = ref<Record<string, { date: boolean, url: boolean }>>({})

const unusedCandidates = computed(() => (props.edition.candidates ?? [])
  .filter(candidate => !draftItems.value.some(item => item.listing_id === candidate.listing_id)))

function toDraftItems(edition: AdminEdition): EditableItem[] {
  const sources = new Map((edition.candidates ?? [])
    .map(candidate => [candidate.listing_id, candidate.source] as const))

  return edition.items.map(item => ({
    kind: item.kind, listing_id: item.listing_id, position: item.position, shipped_at: item.shipped_at,
    provenance_url: item.provenance_url, snapshot_name: item.snapshot_name,
    source: sources.get(item.listing_id) ?? 'unknown',
  }))
}

function resetFromServer(edition: AdminEdition): void {
  serverIntroduction.value = edition.introduction
  introduction.value = edition.introduction ?? ''
  serverItems.value = toDraftItems(edition)
  draftItems.value = toDraftItems(edition)
  itemValidationTouched.value = {}
  introductionError.value = null
  confirmingPublication.value = false
}

resetFromServer(props.edition)
watch(() => props.edition.id, () => resetFromServer(props.edition))

const introductionDirty = computed(() => (introduction.value.trim() || null) !== serverIntroduction.value)
const itemsDirty = computed(() => JSON.stringify(payloadItems()) !== JSON.stringify(serverItemPayloads()))
const canPublish = computed(() => !pending.value && !introductionDirty.value && !itemsDirty.value)

function clearPublicationConfirmation(): void {
  confirmingPublication.value = false
}

function errorMessage(caught: unknown, fallback: string): string {
  const err = toErrorLike(caught)
  return err.data?.message ?? err.data?.error ?? err.message ?? fallback
}

function emitServerEdition(edition: AdminEdition, announcement: string): void {
  message.value = announcement
  emit('updated', edition)
}

function itemKey(listingId: string, direction: string): string {
  return `${listingId}:${direction}`
}

function registerControl(listingId: string, direction: string, element: unknown): void {
  const key = itemKey(listingId, direction)
  if (element instanceof HTMLElement) controlRefs.set(key, element)
  else controlRefs.delete(key)
}

async function restoreMoveFocus(item: EditableItem, direction: Direction): Promise<void> {
  await nextTick()
  const same = controlRefs.get(itemKey(item.listing_id, direction))
  if (same instanceof HTMLButtonElement && !same.disabled) {
    same.focus()
    return
  }
  const opposite = controlRefs.get(itemKey(item.listing_id, direction === 'up' ? 'down' : 'up'))
  if (opposite instanceof HTMLButtonElement && !opposite.disabled) opposite.focus()
}

async function focusControl(listingId: string, direction: Direction | 'add' | 'remove' | 'publish' | 'save' | 'summary'): Promise<void> {
  await nextTick()
  controlRefs.get(itemKey(listingId, direction))?.focus()
}

async function focusAddedItem(listingId: string): Promise<void> {
  await nextTick()
  const remove = controlRefs.get(itemKey(listingId, 'remove'))
  if (remove instanceof HTMLButtonElement && !remove.disabled) {
    void focusControl(listingId, 'remove')
    return
  }
  void focusControl(listingId, 'up')
}

function focusAdjacentRowControl(index: number): void {
  const adjacent = draftItems.value[Math.min(index, draftItems.value.length - 1)]
  if (!adjacent) {
    void focusControl('items', 'save')
    return
  }
  void focusControl(adjacent.listing_id, 'remove')
}

function move(index: number, delta: -1 | 1): void {
  const destination = index + delta
  if (pending.value || destination < 0 || destination >= draftItems.value.length) return
  const [item] = draftItems.value.splice(index, 1)
  if (!item) return
  draftItems.value.splice(destination, 0, item)
  draftItems.value = draftItems.value.map((entry, position) => ({ ...entry, position: position + 1 }))
  clearPublicationConfirmation()
  message.value = `${item.snapshot_name} moved to position ${destination + 1}.`
  void restoreMoveFocus(item, delta === -1 ? 'up' : 'down')
}

function addCandidate(candidate: AdminEditionCandidate): void {
  if (pending.value || draftItems.value.some(item => item.listing_id === candidate.listing_id)) return
  draftItems.value.push({
    kind: 'new_listing',
    listing_id: candidate.listing_id,
    position: draftItems.value.length + 1,
    snapshot_name: candidate.name,
    source: candidate.source,
  })
  clearPublicationConfirmation()
  message.value = `${candidate.name} added to the edition.`
  void focusAddedItem(candidate.listing_id)
}

function removeItem(index: number): void {
  if (pending.value) return
  const [removed] = draftItems.value.splice(index, 1)
  if (!removed) return
  draftItems.value = draftItems.value.map((entry, position) => ({ ...entry, position: position + 1 }))
  clearPublicationConfirmation()
  message.value = `${removed.snapshot_name} removed from the edition.`
  void nextTick(() => {
    const add = controlRefs.get(itemKey(removed.listing_id, 'add'))
    if (add instanceof HTMLButtonElement && !add.disabled) {
      void focusControl(removed.listing_id, 'add')
      return
    }
    focusAdjacentRowControl(index)
  })
}

function dateValidationError(item: EditableItem): string | null {
  if (item.source === 'customer') return null
  const date = item.shipped_at ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return 'Enter a real ship date as YYYY-MM-DD.'
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return 'Enter a real ship date as YYYY-MM-DD.'
  return null
}

function urlValidationError(item: EditableItem): string | null {
  if (item.source === 'customer') return null
  const rawUrl = normalizedProvenanceUrl(item)
  if (!rawUrl || rawUrl.length > 2048 || hasForbiddenUrlCharacter(rawUrl)) {
    return 'Enter a public HTTPS evidence URL without spaces or unsafe characters.'
  }
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
      ? null
      : 'Enter a public HTTPS evidence URL.'
  }
  catch {
    return 'Enter a public HTTPS evidence URL.'
  }
}

function hasForbiddenUrlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return /\s/u.test(character)
      || codePoint <= 0x1f
      || codePoint === 0x7f
      || `"'<>`.includes(character)
  })
}

function normalizedProvenanceUrl(item: EditableItem): string {
  return (item.provenance_url ?? '').trim()
}

function normalizeProvenanceUrl(item: EditableItem): void {
  item.provenance_url = normalizedProvenanceUrl(item) || null
  touchEvidence(item, 'url')
}

function hasValidEvidence(item: EditableItem): boolean {
  return dateValidationError(item) === null && urlValidationError(item) === null
}

function evidenceTouched(item: EditableItem, field: 'date' | 'url'): boolean {
  return itemValidationTouched.value[item.listing_id]?.[field] ?? false
}

function touchEvidence(item: EditableItem, field: 'date' | 'url'): void {
  const current = itemValidationTouched.value[item.listing_id] ?? { date: false, url: false }
  itemValidationTouched.value[item.listing_id] = { ...current, [field]: true }
  clearPublicationConfirmation()
}

function touchAllEvidence(): void {
  draftItems.value.forEach(item => {
    if (item.source !== 'customer') itemValidationTouched.value[item.listing_id] = { date: true, url: true }
  })
}

function dateErrorId(item: EditableItem): string { return `edition-item-${item.listing_id}-ship-date-error` }
function urlErrorId(item: EditableItem): string { return `edition-item-${item.listing_id}-evidence-url-error` }

function payloadItems(): AdminEditionItemInput[] {
  return draftItems.value.map((item, index) => {
    const base = { kind: 'new_listing' as const, listing_id: item.listing_id, position: index + 1 }
    return item.source === 'customer'
      ? base
      : { ...base, shipped_at: item.shipped_at ?? null, provenance_url: normalizedProvenanceUrl(item) || null }
  })
}

function serverItemPayloads(): AdminEditionItemInput[] {
  return serverItems.value.map((item, index) => {
    const base = { kind: 'new_listing' as const, listing_id: item.listing_id, position: index + 1 }
    return item.source === 'customer' ? base : { ...base, shipped_at: item.shipped_at ?? null, provenance_url: normalizedProvenanceUrl(item) || null }
  })
}

async function saveIntroduction(): Promise<void> {
  if (pending.value || !introductionDirty.value) return
  const siblingItemsDirty = itemsDirty.value
  pendingAction.value = 'intro'
  error.value = null
  introductionError.value = null
  try {
    const updated = await editions.updateIntroduction(props.edition.id, introduction.value.trim() || null)
    serverIntroduction.value = updated.introduction
    introduction.value = updated.introduction ?? ''
    serverItems.value = toDraftItems(updated)
    if (!siblingItemsDirty) draftItems.value = toDraftItems(updated)
    emitServerEdition(updated, 'Introduction saved.')
  }
  catch (caught: unknown) {
    introductionError.value = errorMessage(caught, 'The introduction could not be saved.')
    message.value = 'Introduction save failed.'
  }
  finally {
    pendingAction.value = null
  }
}

async function saveItems(): Promise<void> {
  if (pending.value || !itemsDirty.value) return
  if (!draftItems.value.every(hasValidEvidence)) {
    touchAllEvidence()
    error.value = 'Admin and founding listings need a real ship date and a public HTTPS evidence URL.'
    message.value = 'Item validation failed.'
    return
  }
  const siblingIntroductionDirty = introductionDirty.value
  pendingAction.value = 'items'
  error.value = null
  try {
    const updated = await editions.replaceItems(props.edition.id, payloadItems())
    serverItems.value = toDraftItems(updated)
    draftItems.value = toDraftItems(updated)
    serverIntroduction.value = updated.introduction
    if (!siblingIntroductionDirty) introduction.value = updated.introduction ?? ''
    emitServerEdition(updated, 'Edition item order saved.')
  }
  catch (caught: unknown) {
    error.value = errorMessage(caught, 'The edition items could not be saved.')
    message.value = 'Item save failed.'
  }
  finally {
    pendingAction.value = null
  }
}

async function publishEdition(): Promise<void> {
  if (pending.value || !canPublish.value) return
  if (!confirmingPublication.value) {
    confirmingPublication.value = true
    message.value = 'Confirm publication to make this editorial record immutable.'
    return
  }
  pendingAction.value = 'publish'
  error.value = null
  try {
    const updated = await editions.publish(props.edition.id)
    emitServerEdition(updated, 'Edition published. Editorial content and order are now immutable.')
    void focusControl('publication', 'summary')
  }
  catch (caught: unknown) {
    error.value = errorMessage(caught, 'The edition could not be published.')
    message.value = 'Publication failed.'
  }
  finally {
    pendingAction.value = null
  }
}

async function setVisibility(itemId: string, visible: boolean): Promise<void> {
  if (pending.value) return
  pendingAction.value = 'visibility'
  pendingItemId.value = itemId
  error.value = null
  try {
    emitServerEdition(await editions.setVisibility(props.edition.id, itemId, visible), `Item ${visible ? 'shown' : 'hidden'}.`)
  }
  catch (caught: unknown) {
    error.value = errorMessage(caught, 'Item visibility could not be updated.')
    message.value = 'Visibility update failed.'
  }
  finally {
    pendingItemId.value = null
    pendingAction.value = null
  }
}
</script>

<template>
  <section class="border border-release-seam bg-release-rail p-4 sm:p-6" aria-labelledby="edition-editor-heading">
    <div class="flex flex-wrap items-start justify-between gap-4 border-b border-release-seam pb-5">
      <div>
        <p class="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-release-warning">Weekly release record</p>
        <h2 id="edition-editor-heading" class="mt-1 text-xl font-semibold text-release-paper">{{ edition.slug }}</h2>
      </div>
      <span class="border border-release-seam bg-release-ink px-2 py-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-release-paper-muted">{{ edition.status }}</span>
    </div>

    <p aria-live="polite" class="sr-only">{{ message }}</p>
    <div v-if="error" role="alert" class="mt-5 border border-release-destructive/40 bg-release-destructive/10 px-4 py-3 text-sm text-release-destructive">{{ error }}</div>

    <div v-if="edition.status === 'published'" class="mt-6">
      <h3 :ref="element => registerControl('publication', 'summary', element)" tabindex="-1" class="max-w-2xl text-sm leading-6 text-release-paper-muted">This record is published. Its editorial content and order are immutable.</h3>
      <div class="mt-5 grid gap-3">
        <AdminEditionItemControls v-for="item in edition.items" :key="item.id" :item="item" :pending="pending" :visibility-pending="pendingAction === 'visibility' && pendingItemId === item.id" @visibility="setVisibility" />
      </div>
    </div>

    <div v-else class="mt-6 grid gap-8">
      <section class="grid gap-3" aria-labelledby="edition-introduction-heading">
        <div>
          <h3 id="edition-introduction-heading" class="text-sm font-semibold text-release-paper">Edition introduction</h3>
          <p class="mt-1 text-xs leading-5 text-release-paper-muted">A concise operator note for this week.</p>
        </div>
        <label for="edition-introduction" class="text-sm font-medium text-release-paper">Introduction</label>
        <textarea id="edition-introduction" v-model="introduction" :disabled="pending" :aria-invalid="!!introductionError" :aria-describedby="introductionError ? 'edition-introduction-help edition-introduction-error' : 'edition-introduction-help'" class="release-field min-h-28 w-full px-3 py-2.5 text-sm" maxlength="3000" @input="introductionError = null; clearPublicationConfirmation()" />
        <p id="edition-introduction-help" class="text-xs text-release-paper-muted">Up to 3,000 characters.</p>
        <p v-if="introductionError" id="edition-introduction-error" role="alert" class="text-xs text-release-destructive">{{ introductionError }}</p>
        <div><button type="button" class="min-h-11 border border-release-seam bg-release-ink px-4 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-paper hover:border-release-warning hover:text-release-warning active:border-release-paper active:bg-release-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :disabled="pending || !introductionDirty" :aria-busy="pendingAction === 'intro'" @click="saveIntroduction">{{ pendingAction === 'intro' ? 'Saving introduction…' : 'Save introduction' }}</button></div>
      </section>

      <section class="border-y border-release-seam py-6" aria-labelledby="edition-items-heading">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 id="edition-items-heading" class="text-sm font-semibold text-release-paper">Editorial order</h3>
            <p class="mt-1 text-xs leading-5 text-release-paper-muted">Save sends the complete ordered set.</p>
          </div>
          <button :ref="element => registerControl('items', 'save', element)" type="button" class="min-h-11 border border-release-paper bg-release-paper px-4 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-ink hover:border-release-warning hover:bg-release-warning active:border-release-paper active:bg-release-paper/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :disabled="pending || !itemsDirty" :aria-busy="pendingAction === 'items'" @click="saveItems">{{ pendingAction === 'items' ? 'Saving item set…' : 'Save item set' }}</button>
        </div>

        <p v-if="!draftItems.length" class="mt-5 border border-release-seam bg-release-ink p-4 text-sm text-release-paper-muted">No listings selected yet.</p>
        <ol v-else class="mt-5 grid gap-4">
          <li v-for="(item, index) in draftItems" :key="item.listing_id" class="border border-release-seam bg-release-ink p-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0"><p class="font-semibold text-release-paper">{{ item.snapshot_name }}</p><p class="mt-1 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-release-paper-muted">Position {{ index + 1 }} · {{ item.source }}</p></div>
              <div class="flex flex-wrap gap-2">
                <button :ref="element => registerControl(item.listing_id, 'up', element)" :data-reorder-listing-id="item.listing_id" data-reorder-direction="up" type="button" class="min-h-11 border border-release-seam px-3 font-mono text-xs text-release-paper hover:border-release-warning hover:text-release-warning active:border-release-paper active:bg-release-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :aria-label="`Move up ${item.snapshot_name}`" :disabled="pending || index === 0" @click="move(index, -1)">Move up</button>
                <button :ref="element => registerControl(item.listing_id, 'down', element)" :data-reorder-listing-id="item.listing_id" data-reorder-direction="down" type="button" class="min-h-11 border border-release-seam px-3 font-mono text-xs text-release-paper hover:border-release-warning hover:text-release-warning active:border-release-paper active:bg-release-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :aria-label="`Move down ${item.snapshot_name}`" :disabled="pending || index === draftItems.length - 1" @click="move(index, 1)">Move down</button>
                <button :ref="element => registerControl(item.listing_id, 'remove', element)" type="button" class="min-h-11 border border-release-destructive/50 px-3 font-mono text-xs text-release-destructive hover:border-release-destructive hover:bg-release-destructive/10 active:border-release-destructive active:bg-release-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-destructive disabled:cursor-not-allowed disabled:opacity-50" :aria-label="`Remove ${item.snapshot_name}`" :disabled="pending" @click="removeItem(index)">Remove</button>
              </div>
            </div>
            <div v-if="item.source !== 'customer'" class="mt-4 grid gap-3 border-t border-release-seam pt-4 sm:grid-cols-2">
              <label class="grid gap-1.5 text-xs text-release-paper-muted"><span>Ship date</span><input v-model="item.shipped_at" :disabled="pending" type="text" inputmode="numeric" placeholder="YYYY-MM-DD" :aria-invalid="evidenceTouched(item, 'date') && !!dateValidationError(item)" :aria-describedby="evidenceTouched(item, 'date') && dateValidationError(item) ? dateErrorId(item) : undefined" class="release-field h-11 px-3 text-sm" @input="touchEvidence(item, 'date')"><span v-if="evidenceTouched(item, 'date') && dateValidationError(item)" :id="dateErrorId(item)" class="text-release-destructive">{{ dateValidationError(item) }}</span></label>
              <label class="grid gap-1.5 text-xs text-release-paper-muted"><span>Public HTTPS evidence</span><input v-model="item.provenance_url" :disabled="pending" type="url" maxlength="2048" placeholder="https://example.com/release" :aria-invalid="evidenceTouched(item, 'url') && !!urlValidationError(item)" :aria-describedby="evidenceTouched(item, 'url') && urlValidationError(item) ? urlErrorId(item) : undefined" class="release-field h-11 px-3 text-sm" @input="touchEvidence(item, 'url')" @blur="normalizeProvenanceUrl(item)"><span v-if="evidenceTouched(item, 'url') && urlValidationError(item)" :id="urlErrorId(item)" class="text-release-destructive">{{ urlValidationError(item) }}</span></label>
            </div>
          </li>
        </ol>
      </section>

      <section aria-labelledby="edition-candidates-heading">
        <h3 id="edition-candidates-heading" class="text-sm font-semibold text-release-paper">Eligible listings</h3>
        <p class="mt-1 text-xs leading-5 text-release-paper-muted">Select a listing once; duplicate listing IDs are blocked.</p>
        <p v-if="!unusedCandidates.length" class="mt-4 border border-release-seam bg-release-ink p-4 text-sm text-release-paper-muted">No additional eligible listings.</p>
        <ul v-else class="mt-4 grid gap-2">
          <li v-for="candidate in unusedCandidates" :key="candidate.listing_id" class="flex flex-wrap items-center justify-between gap-3 border border-release-seam bg-release-ink p-3"><span class="min-w-0 text-sm text-release-paper">{{ candidate.name }} <span class="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-release-paper-muted">{{ candidate.source }}</span></span><button :ref="element => registerControl(candidate.listing_id, 'add', element)" type="button" class="min-h-11 border border-release-seam px-3 font-mono text-xs text-release-paper hover:border-release-warning hover:text-release-warning active:border-release-paper active:bg-release-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :aria-label="`Add ${candidate.name}`" :disabled="pending" @click="addCandidate(candidate)">Add</button></li>
        </ul>
      </section>

      <section class="border-t border-release-seam pt-6" aria-labelledby="edition-publication-heading">
        <h3 id="edition-publication-heading" class="text-sm font-semibold text-release-paper">Publish edition</h3>
        <p class="mt-1 max-w-2xl text-xs leading-5 text-release-paper-muted">Publication freezes editorial content and order. Confirm only when this record is final.</p>
        <p v-if="introductionDirty || itemsDirty" class="mt-2 text-xs text-release-warning">Save both draft changes before publishing.</p>
        <div class="mt-4 flex flex-wrap gap-2"><button :ref="element => registerControl('publication', 'publish', element)" type="button" class="min-h-11 border border-release-warning bg-release-warning px-4 font-mono text-xs font-semibold uppercase tracking-[0.1em] text-release-ink hover:border-release-paper hover:bg-release-paper active:border-release-paper active:bg-release-paper/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :disabled="!canPublish" :aria-busy="pendingAction === 'publish'" @click="publishEdition">{{ pendingAction === 'publish' ? 'Publishing…' : confirmingPublication ? 'Confirm publication' : 'Publish edition' }}</button><button v-if="confirmingPublication" type="button" class="min-h-11 border border-release-seam px-4 font-mono text-xs text-release-paper hover:border-release-paper-muted active:border-release-paper active:bg-release-paper/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-release-focus disabled:cursor-not-allowed disabled:opacity-50" :disabled="pending" @click="confirmingPublication = false; focusControl('publication', 'publish')">Cancel</button></div>
      </section>
    </div>
  </section>
</template>
