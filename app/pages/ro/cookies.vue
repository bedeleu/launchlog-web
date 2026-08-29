<script setup lang="ts">
const config = useRuntimeConfig()
const siteUrl = `https://${config.public.domain || 'launchlog.ai'}`
const pageUrl = `${siteUrl}/ro/cookies`
const updatedIso = '2026-08-29'
const updated = '29 august 2026'
const legalEmail = config.public.legalEmail.trim()
const description
  = 'Datele exacte stocate de LaunchLog în browser, alegerea opțională privind analiza Plausible, cookie-urile Stripe și modul în care vă puteți schimba preferințele.'

const sections = [
  {
    id: 'rezumat',
    title: 'Stocarea pe scurt',
    blocks: [
      { type: 'p', text: 'LaunchLog folosește stocarea în browser necesară funcțiilor pe care le solicitați și unui singur scop opțional de analiză. Stocarea esențială rămâne disponibilă deoarece autentificarea, recuperarea previzualizării, gestionarea revenirii de la finalizarea comenzii și reținerea alegerii privind confidențialitatea nu ar funcționa în mod fiabil fără ea.' },
      { type: 'p', text: 'Analiza opțională Plausible găzduită de noi este dezactivată implicit. După ce acceptați analiza, LaunchLog poate trimite o solicitare directă și controlată către API-ul Events Plausible găzduit de noi. Nu este activ niciun Reddit Pixel, cookie publicitar sau integrare nativă de conversii publicitare.' },
    ],
  },
  {
    id: 'stocare-launchlog',
    title: 'Stocarea primară LaunchLog',
    blocks: [
      { type: 'p', text: 'Aplicația curentă folosește următoarele înregistrări denumite în browser:' },
      { type: 'list', items: [
        'launchlog:privacy-consent:v1 — înregistrare localStorage care conține versiunea politicii, alegerea privind analiza și momentul deciziei. Scop: reținerea și aplicarea alegerii curente. Este considerată expirată după șase luni și eliminată la următoarea încărcare relevantă a aplicației, revenire în fereastră sau citire a stocării; ștergerea datelor site-ului ori o versiune ulterioară o elimină sau înlocuiește mai devreme.',
        'launchlog:magic-link-email și launchlog:magic-link-email-expires-at — înregistrări localStorage care conțin adresa de e-mail introdusă pentru autentificarea prin link trimis pe e-mail și data expirării. Scop: finalizarea autentificării pe același dispozitiv. Nu mai sunt acceptate după o oră și sunt eliminate la următoarea citire/încărcare a aplicației; sunt eliminate imediat și după orice autentificare reușită, o reîncercare eșuată cu adresa stocată, deconectare, înlocuire sau ștergerea datelor site-ului.',
        'launchlog:intake:last-url și launchlog:intake:last-url-expires-at — înregistrări localStorage folosite pentru reluarea ultimului URL trimis pentru o previzualizare. Nu mai sunt acceptate după șapte zile sau după expirarea mai apropiată a previzualizării asociate și sunt eliminate la următoarea încărcare/rezolvare; nevaliditatea, înlocuirea sau ștergerea datelor site-ului le elimină mai devreme.',
        'launchlog:intake:latest-token — înregistrare localStorage care identifică cea mai recentă previzualizare privată din browserul respectiv. Rămâne până când este înlocuită de altă previzualizare, până când expirarea înregistrată a previzualizării este eliminată la încărcarea aplicației sau până când ștergeți datele site-ului.',
        'launchlog:intake:drafts — schițe de previzualizare în localStorage care pot include tokenul privat, URL-ul sursă, câmpurile listării, adresa de e-mail de contact, planul ales și momentul expirării. O schiță nu mai este acceptată după expirarea înregistrată a previzualizării sau după șapte zile de la ultima actualizare, oricare survine prima, și este eliminată la următoarea încărcare a aplicației ori încercare de recuperare.',
        'launchlog:intake:url-index — index localStorage între un URL trimis în formă normalizată și tokenul previzualizării private. O intrare rămâne numai cât timp există schița asociată sau până când ștergeți datele site-ului.',
        'launchlog:intake:preferred-tier — valoare localStorage de unică folosință care transferă alegerea unui plan tarifar în fluxul de previzualizare. Rămâne până când este aplicată unei previzualizări, este înlocuită cu altă alegere sau este ștearsă.',
        'launchlog:checkout-return:<preview-token> — marcaj sessionStorage folosit pentru reconcilierea revenirii de la Stripe. Este eliminat după reconciliere și, în orice caz, dispare la încheierea sesiunii browserului.',
      ] },
      { type: 'p', text: 'Curățarea previzualizărilor rulează la încărcarea aplicației și la rezolvarea unui URL salvat. Aceasta elimină schițele cu o expirare înregistrată depășită sau nevalidă, intrările lor din indexul URL și referința expirată către cel mai recent token. Puteți elimina mai devreme toate înregistrările LaunchLog prin ștergerea datelor site-ului din browser.' },
    ],
  },
  {
    id: 'autentificare',
    title: 'Stocarea pentru autentificare',
    blocks: [
      { type: 'p', text: 'Firebase Authentication poate folosi IndexedDB, localStorage sau o formă similară de persistență primară în browser pentru a restabili o sesiune autentificată și a proteja accesul la cont. Aceasta este folosită numai pentru serviciul de autentificare pe care îl solicitați. Ștergerea acestor date vă deconectează.' },
    ],
  },
  {
    id: 'analiza',
    title: 'Analiza opțională',
    blocks: [
      { type: 'p', text: 'Nu este instalat niciun script furnizat de Plausible, listener automat furnizat de Plausible, cookie de analiză sau identificator persistent de analiză. După consimțământ, expeditorul controlat propriu al LaunchLog poate efectua o solicitare directă către API-ul Events Plausible găzduit de noi. Corpul solicitării conține numai domeniul site-ului, numele unui eveniment aprobat și un URL public sanitizat; solicitarea este trimisă fără credențiale cookie și fără referrer.' },
      { type: 'p', text: 'Evenimentele conectate din browser sunt o vizualizare de pagină pe o rută publică permisă și trei evenimente de funnel: Preview Created, Checkout Started și Payment Canceled. Listing Published rămâne un nume rezervat de obiectiv aprobat, însă nu este trimis niciun eveniment de publicare până la activarea unui contract separat, verificat, privind consimțământul și păstrarea datelor pe server. Vizualizările paginilor publice pot păstra câte o valoare limitată pentru fiecare câmp UTM aprobat. Evenimentele de funnel folosesc URL-ul /submit fără query. Filtrul respinge previzualizările private, URL-urile de checkout, rutele contului, tokenurile, identificatorii sesiunilor Stripe, valorile rdt_cid, parametrii query arbitrari și proprietățile personalizate.' },
    ],
  },
  {
    id: 'stripe',
    title: 'Finalizarea comenzii și facturarea prin Stripe',
    blocks: [
      { type: 'p', text: 'Atunci când alegeți finalizarea comenzii sau deschideți portalul de facturare, părăsiți LaunchLog și accesați o pagină găzduită de Stripe. Stripe poate seta cookie-uri sau folosi tehnologii similare de stocare necesare pentru securitatea plății, prevenirea fraudei, continuitatea sesiunii și respectarea reglementărilor. Stripe controlează aceste înregistrări conform propriilor informări privind confidențialitatea și cookie-urile.' },
    ],
  },
  {
    id: 'optiuni',
    title: 'Gestionarea sau retragerea alegerii',
    blocks: [
      { type: 'p', text: 'Deschideți în orice moment „Opțiuni de confidențialitate” din subsol. Acceptarea și refuzarea sunt disponibile cu aceeași vizibilitate în primul nivel. Analiza opțională începe numai după acceptare; refuzarea sau retragerea oprește solicitările viitoare de analiză fără a afecta funcțiile esențiale. Retragerea nu șterge automat evenimentele agregate deja înregistrate; aceste evenimente istorice rămân supuse perioadelor de păstrare și drepturilor descrise în Politica de confidențialitate.' },
      { type: 'p', text: 'Setările browserului pot, de asemenea, să blocheze sau să șteargă datele stocate. Blocarea stocării esențiale vă poate deconecta, poate împiedica finalizarea autentificării prin link trimis pe e-mail, poate elimina starea de recuperare a previzualizării sau poate afecta finalizarea comenzii prin Stripe.' },
    ],
  },
  {
    id: 'modificari',
    title: 'Tehnologii noi și modificări',
    blocks: [
      { type: 'p', text: 'Un nou instrument de urmărire publicitară sau un scop de analiză semnificativ diferit va necesita un audit, o informare și o versiune a consimțământului actualizate, acolo unde este aplicabil. Nu vom considera drept consimțământ continuarea navigării, inacțiunea sau un control preselectat.' },
    ],
  },
]

useSeoMeta({
  title: 'Politica privind cookie-urile — LaunchLog',
  description,
  ogTitle: 'Politica privind cookie-urile — LaunchLog',
  ogDescription: description,
  ogUrl: pageUrl,
  ogType: 'website',
  twitterTitle: 'Politica privind cookie-urile — LaunchLog',
  twitterDescription: description,
})

useHead({
  htmlAttrs: { lang: 'ro' },
  link: [
    { rel: 'canonical', href: pageUrl },
    { rel: 'alternate', hreflang: 'ro-RO', href: pageUrl },
    { rel: 'alternate', hreflang: 'en-US', href: `${siteUrl}/cookies` },
    { rel: 'alternate', hreflang: 'x-default', href: `${siteUrl}/cookies` },
  ],
  script: [
    {
      key: 'launchlog-cookies-ro-schema',
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Politica privind cookie-urile — LaunchLog',
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
    title="Politica privind cookie-urile și stocarea în browser"
    intro="Înregistrările primare exacte folosite de LaunchLog, ce este esențial, ce este opțional și cum vă puteți modifica alegerea privind analiza."
    :updated="updated"
    :sections="sections"
    :contact-email="legalEmail"
    alternate-path="/cookies"
    alternate-label="English"
  />
</template>
