<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/ro/privacy`
const updatedIso = '2026-08-29'
const updated = '29 august 2026'
const operatorBrand = config.public.operatorBrand.trim()
const legalName = config.public.legalName.trim()
const legalAddress = config.public.legalAddress.trim()
const legalRegistrationId = config.public.legalRegistrationId.trim()
const legalTaxId = String(config.public.legalTaxId ?? '').trim()
const legalShareCapital = config.public.legalShareCapital.trim()
const legalEmail = config.public.legalEmail.trim()
const description
  = 'Cum prelucrează LaunchLog datele cu caracter personal pentru listări, conturi, plăți, asistență, analiză și funcționarea serviciului, precum și drepturile dumneavoastră.'

const controllerFacts = [
  legalName ? `Denumire juridică: ${legalName}.` : null,
  legalAddress ? `Sediu social: ${legalAddress}.` : null,
  legalRegistrationId ? `Număr de înregistrare: ${legalRegistrationId}.` : null,
  legalTaxId ? `Cod de identificare fiscală: ${legalTaxId}.` : null,
  legalShareCapital ? `Capital social: ${legalShareCapital}.` : null,
  legalEmail ? `Contact pentru confidențialitate: ${legalEmail}.` : null,
].filter((fact): fact is string => fact !== null)

const sections = [
  {
    id: 'operator',
    title: 'Cine este operatorul datelor dumneavoastră',
    blocks: [
      { type: 'p', text: `${operatorBrand || 'AB Solutions'} operează serviciul LaunchLog la launchlog.ai. Furnizorul contractual este entitatea juridică identificată mai jos și este operatorul prelucrărilor descrise în această politică.` },
      ...(controllerFacts.length ? [{ type: 'list', items: controllerFacts }] : []),
      { type: 'p', text: 'Colectăm numai datele necesare pentru furnizarea și protejarea directorului. Nu vindem și nu divulgăm date cu caracter personal pentru publicitate comportamentală în contexte diferite, nu închiriem liste de contacte și nu construim profiluri publicitare.' },
    ],
  },
  {
    id: 'date-prelucrate',
    title: 'Date cu caracter personal și surse',
    blocks: [
      { type: 'subhead', text: 'Date furnizate de dumneavoastră' },
      { type: 'list', items: [
        'Date de cont: adresa de e-mail, identificatorul Firebase Authentication și starea contului atunci când vă autentificați.',
        'Date despre previzualizare și listare: URL-ul trimis, conținutul produsului, categoria, adresa de e-mail de contact, modificările și istoricul moderării.',
        'Date de facturare: referințe de client și abonament, planul, starea plății și informațiile din facturi și chitanțe. Datele cardului sunt introduse direct în Stripe și nu ajung pe serverele LaunchLog.',
        'Dovezi contractuale: versiunea Termenilor acceptați, cererea expresă de executare imediată, versiunea informării, limba, momentul înregistrat de server și referințele de checkout/contract folosite pentru a dovedi ce s-a convenit. Nu folosim ca dovadă un moment de acceptare generat de browser.',
        'Evidențe privind retragerea: numele, detaliile de identificare a contractului furnizate de dumneavoastră, e-mailul de confirmare, limba, textul declarației, momentul/referința de primire generate de server și starea livrării confirmării. Nu trebuie să furnizați un motiv.',
        'Corespondență de asistență și juridică: numele, adresa de e-mail, site-ul și mesajul dumneavoastră atunci când ne contactați.',
      ] },
      { type: 'subhead', text: 'Date generate sau obținute în timpul utilizării serviciului' },
      { type: 'list', items: [
        'Dovezi publice de pe site: titlu, descriere, date OpenGraph, favicon, captură de ecran și metadate publice conexe, preluate de la URL-ul pe care îl trimiteți sau din surse publice folosite pentru întreținerea înregistrărilor din director.',
        'Date de securitate și operare: ora solicitării, ruta, starea răspunsului, adresa IP și user-agent-ul, atunci când furnizorii de infrastructură au nevoie de ele pentru livrare, limitarea frecvenței, prevenirea abuzurilor, diagnosticare și securitate.',
        'Analiză agregată opțională: după alegerea dumneavoastră explicită privind analiza, LaunchLog poate trimite o solicitare directă și controlată către API-ul Events Plausible găzduit de noi. Corpul solicitării este limitat la domeniul site-ului, numele unui eveniment aprobat și un URL public sanitizat. Plausible prelucrează temporar adresa IP și user-agent-ul pentru a deriva un identificator pseudonim zilnic rotativ și dimensiuni agregate privind browserul, sistemul de operare, dispozitivul și țara/regiunea/orașul. Adresele IP brute și șirurile user-agent complete nu sunt păstrate în baza de date de evenimente Plausible.',
        'Contextul campaniei: Plausible poate primi numai setul complet de valori aprobate pentru testul Reddit, prin utm_source, utm_medium, utm_campaign, utm_content și utm_term, pe rutele publice aprobate. Valorile UTM parțiale, arbitrare sau cu formă de identificator, URL-urile private de previzualizare, tokenurile, identificatorii sesiunilor Stripe și identificatorii de clic Reddit sunt blocați. Un parametru rdt_cid primit este eliminat din URL-ul browserului și nu este stocat sau trimis intenționat către Plausible.',
      ] },
    ],
  },
  {
    id: 'scopuri-temeiuri',
    title: 'Scopuri și temeiuri juridice',
    blocks: [
      { type: 'p', text: 'Atunci când se aplică RGPD sau UK GDPR, folosim următoarele temeiuri juridice:' },
      { type: 'list', items: [
        'Contractul și demersurile efectuate la cererea dumneavoastră — pentru a crea o previzualizare, a deschide un cont, a procesa finalizarea comenzii, a publica și întreține o listare plătită, a oferi acces la facturare și a răspunde solicitărilor privind serviciul.',
        'Interese legitime — pentru a proteja serviciul, a preveni frauda și spamul, a diagnostica erori, a proteja pretenții juridice, a menține corecte informațiile publice din director și a efectua o moderare umană proporțională. Punem aceste interese în balanță cu drepturile dumneavoastră.',
        'Obligație legală — pentru a păstra și divulga evidențe privind tranzacțiile, contabilitatea, taxele sau conformitatea atunci când legislația aplicabilă impune acest lucru.',
        'Contractul, obligația legală și pretențiile juridice — pentru a înregistra acceptarea contractului și instrucțiunile de executare imediată, a primi și confirma declarațiile de retragere, a aplica remediile consumatorilor, a preveni procesarea duplicată și a constata, exercita sau apăra pretenții juridice.',
        'Consimțământ — pentru a trimite date opționale de analiză agregată către API-ul Events Plausible găzduit de noi. Refuzarea sau retragerea consimțământului pentru analiză nu afectează accesul la LaunchLog.',
      ] },
      { type: 'p', text: 'Nu luăm decizii care produc efecte juridice sau efecte similare semnificative exclusiv prin mijloace automate. Conținutul opțional asistat de inteligență artificială rămâne o propunere până când o persoană autorizată îl aplică.' },
    ],
  },
  {
    id: 'control-analiza',
    title: 'Controlul analizei și al publicității',
    blocks: [
      { type: 'p', text: 'În browser nu rulează niciun script furnizat de Plausible și niciun listener automat de analiză furnizat de acest operator. După o alegere explicită și validă privind analiza, expeditorul controlat din browser al LaunchLog poate efectua solicitări directe către API-ul Events numai pentru vizualizări aprobate ale paginilor publice și pentru trei evenimente de funnel conectate: Preview Created, Checkout Started și Payment Canceled. Listing Published rămâne un nume de obiectiv aprobat, însă nu este trimis niciun eveniment de publicare până la activarea unui contract separat, verificat, privind consimțământul și păstrarea datelor pe server. Fiecare payload din browser este filtrat înainte de trimitere și nu conține referrer, credențiale cookie sau proprietăți personalizate.' },
      { type: 'p', text: 'Vă puteți retrage consimțământul în orice moment prin „Opțiuni de confidențialitate” din subsol. Retragerea oprește solicitările viitoare de analiză, dar nu șterge automat evenimentele agregate înregistrate înainte de retragere; prelucrarea finalizată anterior rămâne supusă perioadei configurate de păstrare a datelor de analiză și drepturilor dumneavoastră aplicabile privind protecția datelor.' },
      { type: 'p', text: 'Nu este activ niciun Reddit Pixel, cookie publicitar sau integrare Reddit Conversions API. O viitoare funcție de măsurare publicitară ar necesita un scop nou documentat, o evidență a fluxurilor de date, o decizie privind consimțământul acolo unde este aplicabil, actualizarea politicii și o activare tehnică separată.' },
    ],
  },
  {
    id: 'destinatari',
    title: 'Destinatari și persoane împuternicite',
    blocks: [
      { type: 'p', text: 'Divulgăm date numai în măsura necesară pentru a opera LaunchLog, a urma instrucțiunile dumneavoastră, a proteja serviciul sau a respecta legea. Furnizorii actuali de servicii și infrastructură includ:' },
      { type: 'list', items: [
        'Firebase Authentication (Google) — autentificare și identitate.',
        'Stripe — procesator de plăți pentru finalizarea găzduită a comenzii, facturarea abonamentelor, prevenirea fraudei, facturi și portalul de facturare.',
        'Railway — găzduirea aplicației, PostgreSQL și Redis.',
        'Cloudflare — DNS, proxy, securitate și stocarea activelor în R2.',
        'Microlink — capturi de ecran și preluarea metadatelor publice ale site-urilor.',
        'Google Gemini — propuneri opționale de conținut, generate pe server din datele trimise și dovezile publice ale site-ului.',
        'Resend — livrarea e-mailurilor tranzacționale.',
        'Sentry — monitorizarea erorilor aplicației după eliminarea datelor sensibile.',
        'Plausible — endpoint API Events găzduit de noi pentru analiza agregată condiționată de consimțământ.',
        'Better Stack — monitorizarea disponibilității endpointurilor publice de stare.',
      ] },
      { type: 'p', text: 'Putem divulga informații consultanților profesioniști, autorităților competente sau altor părți atunci când legea impune acest lucru ori când este necesar pentru constatarea, exercitarea sau apărarea unor pretenții juridice.' },
    ],
  },
  {
    id: 'pastrare',
    title: 'Perioade de păstrare',
    blocks: [
      { type: 'list', items: [
        'Previzualizările gratuite nu mai sunt disponibile prin endpointul de previzualizare activă după 7 zile. Schițele de previzualizare din browser sunt eliminate după expirarea înregistrată sau, dacă nu există o expirare anterioară, după cel mult 7 zile, la următoarea încărcare a aplicației; ștergerea datelor site-ului le elimină mai devreme.',
        'Înregistrările privind listările publicate și conturile rămân cât timp serviciul sau abonamentul este activ, iar apoi numai atât cât este necesar pentru închiderea contului, soluționarea disputelor, prevenirea abuzurilor și respectarea termenelor de prescripție aplicabile.',
        'Înregistrările de plată, facturare și contabilitate sunt păstrate pe perioada impusă de legislația fiscală și contabilă română aplicabilă.',
        'Dovezile acordului din checkout sunt păstrate pe durata contractului, apoi numai pe perioada de arhivare contabilă/fiscală obligatorie sau de prescripție a pretențiilor aplicabile. Declarațiile și confirmările de retragere sunt păstrate până la soluționarea cererii și a oricărei rambursări/dispute, apoi pe durata termenului de prescripție aplicabil. După încetarea perioadei determinante, datele sunt șterse sau reduse ireversibil, cu excepția unui legal hold documentat.',
        'Jurnalele aplicației, infrastructurii, securității și furnizorilor sunt păstrate numai pentru cea mai scurtă perioadă configurată necesară furnizării și protejării serviciului, investigării incidentelor și îndeplinirii obligațiilor legale aplicabile, apoi sunt șterse sau reduse ireversibil. Un legal hold documentat poate prelungi păstrarea unei înregistrări relevante atunci când este necesar.',
        'Evenimentele agregate Plausible înregistrate anterior rămân pe durata configurată de păstrare a datelor de analiză sau până când sunt șterse printr-un proces operațional ori prin exercitarea unui drept aplicabil. Retragerea consimțământului oprește colectarea viitoare, dar nu șterge automat evenimentele agregate istorice.',
        'Înregistrarea locală a alegerii privind analiza este considerată expirată după șase luni. Este eliminată la următoarea încărcare relevantă a aplicației, revenire în fereastră sau citire a stocării și mai devreme dacă ștergeți datele site-ului ori o versiune ulterioară a politicii o înlocuiește. Aceasta nu este trimisă către Plausible.',
      ] },
      { type: 'p', text: 'Conținutul public al listării poate rămâne temporar în cache-urile terțe ale motoarelor de căutare, rețelelor CDN sau sistemelor de inteligență artificială după eliminare; aceste copii independente nu sunt sub controlul nostru direct, însă vom lua măsuri rezonabile atunci când se aplică o solicitare validă.' },
    ],
  },
  {
    id: 'drepturi',
    title: 'Drepturile dumneavoastră privind protecția datelor',
    blocks: [
      { type: 'p', text: 'În funcție de legislația aplicabilă, puteți solicita accesul, rectificarea, ștergerea, restricționarea prelucrării și portabilitatea datelor sau vă puteți opune prelucrării întemeiate pe interese legitime. Vă puteți retrage consimțământul în orice moment, fără a afecta prelucrarea care a fost legală înainte de retragere.' },
      { type: 'p', text: legalEmail ? `Trimiteți solicitarea la ${legalEmail}. Putem cere informații proporționale pentru verificarea identității și, în mod normal, răspundem în termen de o lună conform RGPD; vom explica orice prelungire permisă.` : 'Folosiți canalul „Juridic și confidențialitate” de pe pagina de contact. Putem cere informații proporționale pentru verificarea identității și, în mod normal, răspundem în termen de o lună conform RGPD; vom explica orice prelungire permisă.' },
      { type: 'p', text: 'Puteți depune o plângere la autoritatea locală de supraveghere. În România, aceasta este ANSPDCP (Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal), la dataprotection.ro.' },
    ],
  },
  {
    id: 'transferuri-securitate',
    title: 'Transferuri internaționale și securitate',
    blocks: [
      { type: 'p', text: 'Unii furnizori pot prelucra date în afara SEE sau a Regatului Unit. Atunci când este necesar, transferurile se bazează pe o decizie privind caracterul adecvat al nivelului de protecție, pe clauze contractuale standard sau pe un alt mecanism legal de transfer prevăzut în acordul furnizorului relevant.' },
      { type: 'p', text: 'Folosim criptarea în tranzit, controale de acces, separarea secretelor, webhookuri de plată semnate, autentificare cu domeniu limitat și eliminarea datelor sensibile. Niciun serviciu nu poate garanta securitatea absolută. Dacă o încălcare a securității datelor cu caracter personal creează un risc care trebuie raportat, respectăm obligațiile de notificare aplicabile.' },
    ],
  },
  {
    id: 'copii-modificari',
    title: 'Copii și modificări ale politicii',
    blocks: [
      { type: 'p', text: 'Serviciile LaunchLog cu plată nu sunt destinate copiilor. Trebuie să aveți capacitatea de a încheia un contract obligatoriu în jurisdicția dumneavoastră. Contactați-ne dacă apreciați că un copil a furnizat în mod necorespunzător date cu caracter personal.' },
      { type: 'p', text: 'Actualizăm această informare atunci când prelucrarea se schimbă semnificativ. Data de mai sus identifică versiunea curentă; acolo unde legea o cere, vom solicita o nouă alegere și nu vom considera tăcerea drept consimțământ.' },
    ],
  },
]

useSeoMeta({
  title: 'Politica de confidențialitate — LaunchLog',
  description,
  ogTitle: 'Politica de confidențialitate — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Politica de confidențialitate — LaunchLog',
  twitterDescription: description,
})

useHead({
  htmlAttrs: { lang: 'ro' },
  link: [
    { rel: 'canonical', href: pageUrl },
    { rel: 'alternate', hreflang: 'ro-RO', href: pageUrl },
    { rel: 'alternate', hreflang: 'en-US', href: `${siteUrl}/privacy` },
    { rel: 'alternate', hreflang: 'x-default', href: `${siteUrl}/privacy` },
  ],
  script: [
    {
      key: 'launchlog-privacy-ro-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Politica de confidențialitate — LaunchLog',
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
    title="Politica de confidențialitate"
    intro="O prezentare precisă a datelor prelucrate de LaunchLog, a motivelor prelucrării, a destinatarilor, a perioadelor de păstrare și a controlului dumneavoastră asupra analizei opționale."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
    alternate-path="/privacy"
    alternate-label="English"
  />
</template>
