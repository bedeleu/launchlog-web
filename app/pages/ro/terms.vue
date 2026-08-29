<script setup lang="ts">
import { CHECKOUT_TERMS_VERSION } from '#shared/constants/checkout-legal'

const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/ro/terms`
const updatedIso = CHECKOUT_TERMS_VERSION
const updated = new Date(`${updatedIso}T00:00:00Z`).toLocaleDateString('ro-RO', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})
const operatorBrand = config.public.operatorBrand.trim() || 'AB Solutions'
const legalName = config.public.legalName.trim()
const legalAddress = config.public.legalAddress.trim()
const legalRegistrationId = config.public.legalRegistrationId.trim()
const legalTaxId = String(config.public.legalTaxId ?? '').trim()
const legalShareCapital = config.public.legalShareCapital.trim()
const legalPhone = config.public.legalPhone.trim()
const legalEmail = config.public.legalEmail.trim()
const supportEmail = config.public.supportEmail.trim()
const taxNotice = config.public.taxNoticeRo.trim()
const description
  = 'Termenii aplicabili conturilor, listărilor, abonamentelor anuale, drepturilor consumatorilor, moderării, anulării și legislației române aplicabile serviciului LaunchLog.'

const providerDetails = [
  legalAddress ? `Sediu social: ${legalAddress}.` : null,
  legalRegistrationId ? `Număr de înregistrare: ${legalRegistrationId}.` : null,
  legalTaxId ? `Cod de identificare fiscală: ${legalTaxId}.` : null,
  legalShareCapital ? `Capital social: ${legalShareCapital}.` : null,
  legalPhone ? `Telefon: ${legalPhone}.` : null,
  legalEmail ? `E-mail: ${legalEmail}.` : null,
].filter((detail): detail is string => detail !== null)

const refundContact = supportEmail || legalEmail || 'canalul „Facturare” de pe pagina noastră de contact'

const sections = [
  {
    id: 'acord-furnizor',
    title: 'Acordul și furnizorul serviciului',
    blocks: [
      { type: 'p', text: 'Acești Termeni reglementează accesul la launchlog.ai și la serviciile LaunchLog conexe. Când solicitați o previzualizare, se aplică termenii de utilizare a previzualizării și licența asupra conținutului, astfel cum sunt prezentate lângă acțiunea de trimitere. Un contract cu plată se formează numai prin acceptarea expresă din fluxul de checkout. Dacă acționați pentru o organizație, confirmați că aveți autoritatea de a o obliga juridic.' },
      { type: 'p', text: `${operatorBrand} este marca publică sub care este operat serviciul. ${legalName ? `Furnizorul contractual al serviciului este ${legalName}.` : 'Furnizorul contractual formal trebuie identificat în informarea juridică configurată înainte de utilizarea în producție a funcțiilor cu plată.'}` },
      ...(providerDetails.length ? [{ type: 'list', items: providerDetails }] : []),
    ],
  },
  {
    id: 'eligibilitate',
    title: 'Eligibilitate și conturi',
    blocks: [
      { type: 'list', items: [
        'Trebuie să aveți cel puțin 18 ani sau vârsta legală necesară pentru a încheia un contract obligatoriu în locul în care locuiți.',
        'Trebuie să furnizați informații corecte, să păstrați în siguranță accesul la cont și să raportați prompt orice utilizare neautorizată.',
        'Serviciul este conceput în principal pentru fondatori, profesioniști și companii. Drepturile obligatorii ale consumatorilor se aplică în continuare ori de câte ori aveți în mod legal calitatea de consumator.',
      ] },
    ],
  },
  {
    id: 'serviciu-plasare',
    title: 'Serviciul și poziționarea listărilor',
    blocks: [
      { type: 'p', text: 'LaunchLog este un director curatoriat care oferă o previzualizare privată gratuită înainte de cumpărare și abonamente anuale cu plată pentru listări. Dovezile publice de pe site-ul trimis pot fi folosite pentru a crea previzualizarea; conținutul opțional asistat de inteligență artificială este o propunere și nu este publicat fără acțiunea unei persoane autorizate.' },
      { type: 'p', text: 'Listările Featured apar înaintea listărilor Standard în cadrul unei pagini a directorului, în limita a trei poziții Featured pe pagină. Listările Featured care depășesc această limită continuă pe paginile următoare. În cadrul fiecărui plan, ordinea este reinițializată o dată pe zi calendaristică UTC. Pagina principală afișează simultan cel mult trei listări Featured.' },
      { type: 'p', text: 'Un abonament oferă eligibilitate pentru poziționarea LaunchLog selectată atât timp cât este activ. Nu garantează o poziție fixă, un număr de afișări, trafic, clicuri, indexare, valoarea backlinkului, vânzări, poziționare în motoarele de căutare sau citare de către sisteme de inteligență artificială.' },
    ],
  },
  {
    id: 'continut',
    title: 'Conținutul listării dumneavoastră',
    blocks: [
      { type: 'p', text: 'Păstrați dreptul de proprietate asupra conținutului pe care îl trimiteți. Acordați furnizorului serviciului o licență neexclusivă, valabilă la nivel mondial, pentru găzduirea, reproducerea, formatarea, afișarea și distribuirea conținutului numai în măsura necesară pentru operarea și promovarea directorului, inclusiv prin date structurate, llms.txt și reprezentări markdown.' },
      { type: 'p', text: 'Confirmați că dețineți controlul asupra conținutului trimis sau aveți permisiunea de a-l folosi și că acesta este corect și legal. Nu puteți trimite fraude, malware, produse ilegale, conținut pentru adulți, jocuri de noroc, încălcări ale drepturilor, afirmații înșelătoare, text ascuns, cloaking, spam sau redirecționări manipulative.' },
    ],
  },
  {
    id: 'abonamente',
    title: 'Preț, abonament și anulare',
    blocks: [
      { type: 'list', items: [
        'Planurile sunt abonamente anuale recurente, taxate în USD prin Stripe. Prețul, intervalul de facturare și informațiile fiscale aplicabile sunt afișate înainte să accesați pagina de finalizare a comenzii Stripe.',
        'Abonamentul se reînnoiește anual până la anulare. Puteți anula reînnoirea viitoare prin portalul de facturare autentificat; anularea nu determină în mod normal rambursarea unei perioade de facturare finalizate.',
        'O modificare de preț se aplică cel mai devreme la următoarea reînnoire și va fi comunicată atunci când legislația aplicabilă impune notificarea.',
        'O listare rămâne publicată numai cât timp abonamentul și starea listării rămân eligibile conform acestor Termeni.',
      ] },
      ...(taxNotice ? [{ type: 'p', text: taxNotice }] : []),
    ],
  },
  {
    id: 'retragere-consumatori',
    title: 'Rambursări și retragerea consumatorilor',
    blocks: [
      { type: 'p', text: `Garanția noastră voluntară de rambursare în 7 zile se adaugă oricărui remediu legal obligatoriu și nu îl restrânge. Solicitați-o prin ${refundContact} în termen de 7 zile de la plata inițială. Returnăm plata inițială identificabilă a abonamentului prin metoda de plată originală, cu excepția cazului în care a fost deja rambursată sau face obiectul unei dispute de plată.` },
      { type: 'p', text: 'Dacă încheiați contractul în calitate de consumator din UE/SEE, aveți, în general, un drept legal de retragere de 14 zile pentru un contract de servicii la distanță. Dacă ne cereți să începem prestarea în această perioadă, vă vom solicita cererea expresă de începere imediată a executării și confirmarea cerută de lege. Dacă vă retrageți după începerea prestării solicitate, dar înainte de executarea integrală, legea obligatorie poate impune plata proporțională a serviciului furnizat. Pierdeți dreptul de retragere numai atunci când sunt îndeplinite condițiile legale privind executarea integrală și confirmarea prealabilă; în caz contrar, drepturile obligatorii rămân neafectate.' },
      { type: 'link', href: '/ro/retragere', text: 'Retrageți-vă din contract aici — transmiteți online declarația de retragere și primiți prin e-mail o confirmare datată. Anularea reînnoirii viitoare prin portalul de facturare este o acțiune separată.' },
      { type: 'p', text: 'Respingerea, retragerea de la publicare sau anularea unei listări nu emite prin ea însăși o rambursare. După perioada voluntară sau legală aplicabilă, sumele plătite nu sunt rambursabile, cu excepția cazurilor în care legislația obligatorie, o neexecutare dovedită a serviciului sau un remediu aprobat impune contrariul.' },
    ],
  },
  {
    id: 'moderare-notificari',
    title: 'Moderare și notificări privind conținutul ilegal',
    blocks: [
      { type: 'p', text: 'Putem modifica, restricționa, retrage de la publicare sau respinge conținutul care încalcă acești Termeni ori drepturile altora, creează un risc de securitate sau este ilegal. Atunci când legislația aplicabilă o impune, comunicăm utilizatorului afectat motivarea și o cale de contestare disponibilă.' },
      { type: 'p', text: 'Raportați conținutul presupus ilegal sau care încalcă drepturi prin canalul „Juridic și confidențialitate” ori „Drepturi de autor” de pe pagina de contact. Includeți URL-ul exact al listării, temeiul juridic, faptele justificative, datele dumneavoastră de contact și o declarație de bună-credință. Putem solicita clarificări și nu vom elimina conținut legal numai pentru că a fost trimisă o notificare.' },
    ],
  },
  {
    id: 'utilizare-acceptabila',
    title: 'Utilizare acceptabilă',
    blocks: [
      { type: 'p', text: 'Nu perturbați, nu testați și nu obțineți acces neautorizat la Serviciu; nu eludați limitele de frecvență; nu folosiți abuziv linkurile private de previzualizare; nu extrageți automat date dincolo de interfețele publice documentate; nu introduceți cod malițios; nu uzurpați identitatea altei persoane și nu folosiți LaunchLog pentru a distribui spam sau materiale ilegale.' },
    ],
  },
  {
    id: 'terti-proprietate-intelectuala',
    title: 'Servicii terțe și proprietate intelectuală',
    blocks: [
      { type: 'p', text: 'Stripe, produsele listate și alte servicii către care există linkuri sunt operate de terți conform propriilor termeni. LaunchLog nu controlează și nu susține fiecare afirmație de pe un site extern. Numele, designul și software-ul LaunchLog sunt protejate de legislația aplicabilă privind proprietatea intelectuală.' },
    ],
  },
  {
    id: 'garantii-raspundere',
    title: 'Conformitate, garanții și răspundere',
    blocks: [
      { type: 'p', text: 'Consumatorii își păstrează drepturile legale de conformitate pentru serviciile digitale și toate drepturile obligatorii ale consumatorilor la remediere, restabilirea conformității, reducerea prețului, încetare sau despăgubiri. Nimic din acești Termeni nu scurtează și nu exclude aceste drepturi.' },
      { type: 'p', text: 'Pentru utilizatorii profesionali și numai în măsura maximă permisă de lege, Serviciul este furnizat „ca atare” și „în funcție de disponibilitate”; nu promitem funcționarea neîntreruptă sau un anumit rezultat comercial, de vizibilitate ori de poziționare. Răspunderea totală este limitată la suma plătită pentru Serviciu în cele 12 luni anterioare pretenției, iar prejudiciile indirecte sau consecutive sunt excluse.' },
      { type: 'p', text: 'Pentru consumatori, răspunderea și remediile sunt guvernate de legea obligatorie. Nicio limitare din acești Termeni nu se aplică fraudei, conduitei intenționate, decesului sau vătămării corporale cauzate prin neglijență ori unei alte răspunderi care nu poate fi limitată legal.' },
    ],
  },
  {
    id: 'incetare-lege',
    title: 'Încetare, legislația română și modificări',
    blocks: [
      { type: 'p', text: 'Puteți înceta utilizarea Serviciului și puteți anula reînnoirea viitoare. Putem suspenda sau înceta accesul în cazul unei încălcări semnificative, al unei amenințări de securitate sau al unei obligații legale, cu o notificare proporțională atunci când este practic posibil.' },
      { type: 'p', text: 'Acești Termeni sunt guvernați de legislația română. Sub rezerva drepturilor obligatorii ale consumatorilor, inclusiv a oricărui drept de a introduce o acțiune în jurisdicția de domiciliu, litigiile sunt de competența instanțelor competente din Timișoara, România.' },
      { type: 'p', text: 'Putem actualiza acești Termeni pentru viitor. Modificările semnificative care afectează un abonament cu plată activ vor fi comunicate atunci când este necesar; o actualizare nu elimină drepturile deja dobândite în temeiul legislației obligatorii.' },
    ],
  },
]

useSeoMeta({
  title: 'Termeni și condiții — LaunchLog',
  description,
  ogTitle: 'Termeni și condiții — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Termeni și condiții — LaunchLog',
  twitterDescription: description,
})

useHead({
  htmlAttrs: { lang: 'ro' },
  link: [
    { rel: 'canonical', href: pageUrl },
    { rel: 'alternate', hreflang: 'ro-RO', href: pageUrl },
    { rel: 'alternate', hreflang: 'en-US', href: `${siteUrl}/terms` },
    { rel: 'alternate', hreflang: 'x-default', href: `${siteUrl}/terms` },
  ],
  script: [
    {
      key: 'launchlog-terms-ro-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Termeni și condiții — LaunchLog',
        description,
        inLanguage: 'ro-RO',
        dateModified: updatedIso,
        isPartOf: { '@id': `${siteUrl}/#website` },
      }),
    },
  ],
})
</script>

<template>
  <LegalDoc
    locale="ro"
    eyebrow="Juridic"
    title="Termeni și condiții"
    intro="Contractul aplicabil previzualizărilor LaunchLog, listărilor cu plată în director, abonamentelor, moderării conținutului, anulării și drepturilor obligatorii ale consumatorilor."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
    alternate-path="/terms"
    alternate-label="English"
  />
</template>
