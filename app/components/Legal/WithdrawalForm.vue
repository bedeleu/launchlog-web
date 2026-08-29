<script setup lang="ts">
import type { CheckoutLegalLocale } from '#shared/constants/checkout-legal'
import type { WithdrawalReceipt } from '~/composables/useWithdrawal'

const props = withDefaults(defineProps<{
  locale?: CheckoutLegalLocale
  legalName?: string
  legalAddress?: string
  legalEmail?: string
  legalRegistrationId?: string
  legalTaxId?: string
}>(), {
  locale: 'en',
  legalName: '',
  legalAddress: '',
  legalEmail: '',
  legalRegistrationId: '',
  legalTaxId: '',
})

const { submit } = useWithdrawal()
const stage = ref<'form' | 'review' | 'submitted'>('form')
const busy = ref(false)
const error = ref<string | null>(null)
const receipt = ref<WithdrawalReceipt | null>(null)
const clientRequestId = ref('')
const stageHeading = ref<HTMLElement | null>(null)
const nameInput = ref<HTMLInputElement | null>(null)
const contractInput = ref<HTMLTextAreaElement | null>(null)
const emailInput = ref<HTMLInputElement | null>(null)
const form = reactive({
  name: '',
  contract_details: '',
  confirmation_email: '',
})
const errors = reactive({
  name: '',
  contract_details: '',
  confirmation_email: '',
})

const isRomanian = computed(() => props.locale === 'ro')
const recipient = computed(() => ({
  name: props.legalName.trim(),
  address: props.legalAddress.trim(),
  email: props.legalEmail.trim(),
  registrationId: props.legalRegistrationId.trim(),
  taxId: String(props.legalTaxId ?? '').trim(),
}))
const recipientReady = computed(() =>
  recipient.value.name.length > 0
  && recipient.value.address.length > 0
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.value.email),
)
const copy = computed(() => isRomanian.value
  ? {
      recipient: 'Destinatarul declarației',
      registeredAddress: 'Sediu social',
      registration: 'Registrul Comerțului',
      taxId: 'Cod de identificare fiscală',
      legalEmail: 'E-mail juridic',
      unavailable: 'Transmiterea online nu este disponibilă încă',
      unavailableBody: 'Datele juridice complete ale destinatarului nu sunt configurate. Pentru a evita trimiterea unei declarații către o entitate neidentificată, formularul rămâne blocat până la completarea denumirii juridice, sediului social și adresei juridice de e-mail.',
      legend: 'Datele declarației',
      name: 'Numele dumneavoastră',
      contract: 'Detalii de identificare a contractului',
      contractHint: 'Folosiți referința contractului LaunchLog, referința plății Stripe ori domeniul/listarea cumpărată.',
      email: 'E-mail pentru confirmare',
      privacy: 'Folosim aceste date numai pentru a înregistra, confirma și soluționa declarația de retragere. Nu includeți date de card, parole sau tokenuri private.',
      review: 'Verificați declarația',
      declaration: 'Declar că mă retrag din contractul identificat mai jos.',
      edit: 'Modificați datele',
      confirm: 'Confirmați retragerea',
      sending: 'Se înregistrează…',
      success: 'Declarația a fost înregistrată',
      successBody: 'Am înregistrat declarația la data și ora de mai jos și am inițiat confirmarea pe suport durabil către adresa indicată. Această confirmare atestă primirea; efectele contractuale și orice rambursare sunt procesate conform legii și contractului.',
      reference: 'Referință de primire',
      submitted: 'Data și ora UTC',
      confirmation: 'Confirmare solicitată pentru',
      genericError: 'Declarația nu a putut fi înregistrată acum. Datele au rămas în formular; încercați din nou.',
    }
  : {
      recipient: 'Declaration recipient',
      registeredAddress: 'Registered address',
      registration: 'Trade Register',
      taxId: 'Tax identification number',
      legalEmail: 'Legal email',
      unavailable: 'Online submission is not available yet',
      unavailableBody: 'The recipient’s complete legal details are not configured. To avoid sending a declaration to an unidentified entity, this form remains blocked until the legal name, registered address and legal email are configured.',
      legend: 'Declaration details',
      name: 'Your name',
      contract: 'Contract identification details',
      contractHint: 'Use your LaunchLog contract reference, Stripe payment reference, or the purchased listing/domain.',
      email: 'Confirmation email',
      privacy: 'We use these details only to record, confirm and process the withdrawal declaration. Do not include card details, passwords or private tokens.',
      review: 'Review declaration',
      declaration: 'I declare that I withdraw from the contract identified below.',
      edit: 'Edit details',
      confirm: 'Confirm withdrawal',
      sending: 'Recording…',
      success: 'Declaration recorded',
      successBody: 'We recorded the declaration at the date and time below and initiated durable confirmation to the address provided. This receipt confirms delivery; the contractual effects and any refund are processed under applicable law and the contract.',
      reference: 'Receipt reference',
      submitted: 'UTC date and time',
      confirmation: 'Confirmation requested for',
      genericError: 'The declaration could not be recorded right now. Your details remain in the form; please try again.',
    })

const declarationText = computed(() => isRomanian.value
  ? `Declar către ${recipient.value.name} că mă retrag din contractul identificat mai jos.`
  : `I hereby notify ${recipient.value.name} that I withdraw from the contract identified below.`)

const validate = (): boolean => {
  errors.name = form.name.trim().length >= 2 && form.name.trim().length <= 120
    ? ''
    : (isRomanian.value ? 'Introduceți între 2 și 120 de caractere.' : 'Enter between 2 and 120 characters.')
  errors.contract_details = form.contract_details.trim().length >= 3 && form.contract_details.trim().length <= 500
    ? ''
    : (isRomanian.value ? 'Introduceți suficiente detalii pentru identificarea contractului.' : 'Enter enough detail to identify the contract.')
  errors.confirmation_email = form.confirmation_email.trim().length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.confirmation_email.trim())
    ? ''
    : (isRomanian.value ? 'Introduceți o adresă de e-mail validă.' : 'Enter a valid email address.')

  return !Object.values(errors).some(Boolean)
}

const focusStageHeading = async () => {
  await nextTick()
  stageHeading.value?.focus()
}

const focusFirstInvalid = async () => {
  await nextTick()
  if (errors.name) nameInput.value?.focus()
  else if (errors.contract_details) contractInput.value?.focus()
  else if (errors.confirmation_email) emailInput.value?.focus()
}

const review = async () => {
  error.value = null
  if (!recipientReady.value) return
  if (!validate()) {
    await focusFirstInvalid()
    return
  }

  stage.value = 'review'
  await focusStageHeading()
}

const edit = async () => {
  stage.value = 'form'
  await focusStageHeading()
}

const createClientRequestId = (): string => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure request identifiers are unavailable.')
  }

  return globalThis.crypto.randomUUID()
}

const confirm = async () => {
  if (busy.value || !recipientReady.value) return
  if (!validate()) {
    stage.value = 'form'
    await focusFirstInvalid()
    return
  }

  busy.value = true
  error.value = null

  try {
    clientRequestId.value ||= createClientRequestId()
    receipt.value = await submit({
      client_request_id: clientRequestId.value,
      name: form.name.trim(),
      contract_details: form.contract_details.trim(),
      confirmation_email: form.confirmation_email.trim(),
      locale: props.locale,
    })
    stage.value = 'submitted'
    await focusStageHeading()
  }
  catch {
    error.value = copy.value.genericError
  }
  finally {
    busy.value = false
  }
}

const formattedSubmittedAt = computed(() => {
  if (!receipt.value?.submitted_at) return ''
  const date = new Date(receipt.value.submitted_at)
  if (Number.isNaN(date.getTime())) return receipt.value.submitted_at

  return new Intl.DateTimeFormat(isRomanian.value ? 'ro-RO' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
})

watch(
  [() => form.name, () => form.contract_details, () => form.confirmation_email],
  () => {
    if (!busy.value && stage.value === 'form') clientRequestId.value = ''
  },
)
</script>

<template>
  <section class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]" aria-labelledby="withdrawal-recipient-heading">
    <div class="border-t border-release-seam pt-8">
      <div data-withdrawal-recipient class="border-l-2 border-release-blaze bg-release-rail px-5 py-4">
        <p class="release-kicker">{{ copy.recipient }}</p>
        <h2 id="withdrawal-recipient-heading" class="mt-2 text-lg font-semibold text-release-paper">
          {{ recipient.name || (isRomanian ? 'Neconfigurat' : 'Not configured') }}
        </h2>
        <dl v-if="recipientReady" class="mt-3 grid gap-2 text-sm leading-6 text-release-paper-muted">
          <div><dt class="inline font-medium text-release-paper">{{ copy.registeredAddress }}: </dt><dd class="inline">{{ recipient.address }}</dd></div>
          <div v-if="recipient.registrationId"><dt class="inline font-medium text-release-paper">{{ copy.registration }}: </dt><dd class="inline">{{ recipient.registrationId }}</dd></div>
          <div v-if="recipient.taxId"><dt class="inline font-medium text-release-paper">{{ copy.taxId }}: </dt><dd class="inline">{{ recipient.taxId }}</dd></div>
          <div><dt class="inline font-medium text-release-paper">{{ copy.legalEmail }}: </dt><dd class="inline break-all">{{ recipient.email }}</dd></div>
        </dl>
      </div>

      <div v-if="!recipientReady" id="withdrawal-form-heading" ref="stageHeading" tabindex="-1" class="mt-6 border border-release-warning/45 bg-release-warning/[0.05] p-5 focus:outline-none" role="alert">
        <h2 class="text-lg font-semibold text-release-paper">{{ copy.unavailable }}</h2>
        <p class="mt-2 text-sm leading-6 text-release-paper-muted">{{ copy.unavailableBody }}</p>
      </div>

      <div v-else-if="stage === 'submitted' && receipt" role="status" aria-live="polite">
        <p class="release-kicker">{{ copy.success }}</p>
        <h2 id="withdrawal-form-heading" ref="stageHeading" tabindex="-1" class="mt-3 text-3xl font-semibold tracking-tight text-release-paper focus:outline-none">{{ copy.success }}</h2>
        <p class="mt-4 max-w-2xl leading-7 text-release-paper-muted">{{ copy.successBody }}</p>

        <dl class="mt-7 grid border-t border-l border-release-seam sm:grid-cols-2">
          <div class="border-r border-b border-release-seam p-5">
            <dt class="font-mono text-[11px] uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.reference }}</dt>
            <dd class="mt-2 break-all text-sm text-release-paper">{{ receipt.receipt_reference }}</dd>
          </div>
          <div class="border-r border-b border-release-seam p-5">
            <dt class="font-mono text-[11px] uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.submitted }}</dt>
            <dd class="mt-2 text-sm text-release-paper">{{ formattedSubmittedAt }}</dd>
          </div>
          <div class="border-r border-b border-release-seam p-5 sm:col-span-2">
            <dt class="font-mono text-[11px] uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.confirmation }}</dt>
            <dd class="mt-2 break-all text-sm text-release-paper">{{ receipt.confirmation_email }}</dd>
          </div>
        </dl>

        <blockquote class="mt-6 border-l-2 border-release-signal bg-release-rail px-5 py-4 text-sm leading-7 text-release-paper-muted">{{ receipt.declaration_text }}</blockquote>
      </div>

      <form v-else novalidate @submit.prevent="stage === 'review' ? confirm() : review()">
        <p class="release-kicker">{{ stage === 'review' ? copy.review : copy.legend }}</p>
        <h2 id="withdrawal-form-heading" ref="stageHeading" tabindex="-1" class="mt-3 text-3xl font-semibold tracking-tight text-release-paper focus:outline-none">
          {{ stage === 'review' ? copy.review : copy.legend }}
        </h2>

        <template v-if="stage === 'form'">
          <div class="mt-7 grid gap-5">
            <div>
              <label for="withdrawal-name" class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.name }}</label>
              <input id="withdrawal-name" ref="nameInput" v-model="form.name" autocomplete="name" required maxlength="120" class="release-field mt-2 h-12 px-3 text-sm" :aria-invalid="!!errors.name" :aria-describedby="errors.name ? 'withdrawal-name-error' : undefined">
              <p v-if="errors.name" id="withdrawal-name-error" class="mt-2 text-xs text-release-warning" role="alert">{{ errors.name }}</p>
            </div>
            <div>
              <label for="withdrawal-contract" class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.contract }}</label>
              <textarea id="withdrawal-contract" ref="contractInput" v-model="form.contract_details" rows="4" required maxlength="500" class="release-field mt-2 min-h-28 resize-y px-3 py-3 text-sm leading-6" :aria-invalid="!!errors.contract_details" :aria-describedby="errors.contract_details ? 'withdrawal-contract-hint withdrawal-contract-error' : 'withdrawal-contract-hint'" />
              <p id="withdrawal-contract-hint" class="mt-2 text-xs leading-5 text-release-paper-muted">{{ copy.contractHint }}</p>
              <p v-if="errors.contract_details" id="withdrawal-contract-error" class="mt-2 text-xs text-release-warning" role="alert">{{ errors.contract_details }}</p>
            </div>
            <div>
              <label for="withdrawal-email" class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.email }}</label>
              <input id="withdrawal-email" ref="emailInput" v-model="form.confirmation_email" type="email" autocomplete="email" required maxlength="254" class="release-field mt-2 h-12 px-3 text-sm" :aria-invalid="!!errors.confirmation_email" :aria-describedby="errors.confirmation_email ? 'withdrawal-email-error' : undefined">
              <p v-if="errors.confirmation_email" id="withdrawal-email-error" class="mt-2 text-xs text-release-warning" role="alert">{{ errors.confirmation_email }}</p>
            </div>
          </div>

          <p class="mt-6 border-l-2 border-release-signal bg-release-rail px-4 py-3 text-xs leading-5 text-release-paper-muted">
            {{ copy.privacy }}
            <NuxtLink :to="isRomanian ? '/ro/privacy' : '/privacy'" class="text-release-blaze underline underline-offset-4">{{ isRomanian ? 'Politica de confidențialitate' : 'Privacy Policy' }}</NuxtLink>.
          </p>

          <button type="submit" class="release-action mt-6">{{ copy.review }}</button>
        </template>

        <template v-else-if="stage === 'review'">
          <p class="mt-6 border-l-2 border-release-blaze bg-release-rail px-5 py-4 text-base leading-7 text-release-paper">{{ declarationText }}</p>
          <dl class="mt-6 grid border-t border-l border-release-seam sm:grid-cols-2">
            <div class="border-r border-b border-release-seam p-4">
              <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.name }}</dt>
              <dd class="mt-2 break-words text-sm text-release-paper">{{ form.name }}</dd>
            </div>
            <div class="border-r border-b border-release-seam p-4">
              <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.email }}</dt>
              <dd class="mt-2 break-all text-sm text-release-paper">{{ form.confirmation_email }}</dd>
            </div>
            <div class="border-r border-b border-release-seam p-4 sm:col-span-2">
              <dt class="font-mono text-[10px] uppercase tracking-[0.12em] text-release-paper-muted">{{ copy.contract }}</dt>
              <dd class="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-release-paper">{{ form.contract_details }}</dd>
            </div>
          </dl>

          <div class="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" class="release-action-secondary" :disabled="busy" @click="edit">{{ copy.edit }}</button>
            <button type="submit" class="release-action" :disabled="busy">
              <AppSpinner v-if="busy" color="text-current" :label="copy.sending" />
              {{ busy ? copy.sending : copy.confirm }}
            </button>
          </div>
        </template>

        <p v-if="error" class="mt-4 text-sm leading-6 text-release-warning" role="alert" aria-live="assertive">{{ error }}</p>
      </form>
    </div>

    <aside class="border-t border-release-seam pt-8 text-sm leading-6 text-release-paper-muted">
      <p class="release-kicker">{{ isRomanian ? 'Important' : 'Important' }}</p>
      <ul class="mt-4 space-y-3">
        <li>{{ isRomanian ? 'Nu trebuie să indicați un motiv.' : 'You do not need to provide a reason.' }}</li>
        <li>{{ isRomanian ? 'Retragerea este diferită de anularea reînnoirii viitoare.' : 'Withdrawal is separate from cancelling a future renewal.' }}</li>
        <li>{{ isRomanian ? 'Păstrați referința și e-mailul de confirmare.' : 'Keep the receipt reference and confirmation email.' }}</li>
      </ul>
    </aside>
  </section>
</template>
