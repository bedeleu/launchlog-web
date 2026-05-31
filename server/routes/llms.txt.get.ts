// server/routes/llms.txt.get.ts
// Dynamic /llms.txt — concise, factual map for answer engines.
export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  const site = getSiteUrl()
  return `# LaunchLog

> LaunchLog is a curated paid directory for indie makers, SaaS founders and tech launches. Tagline: "The log of what just shipped."

LaunchLog publishes human-reviewed product listings with schema.org JSON-LD, canonical URLs and markdown-negotiated pages so launches are discoverable by both search engines and AI answer engines (ChatGPT, Perplexity, Claude, Gemini).

Canonical site: ${site}

## Key pages

- Homepage: ${site}/
- Browse all listings: ${site}/browse-all
- Featured launches: ${site}/featured
- Tech products: ${site}/tech-products
- Pricing: ${site}/pricing
- Submit a product: ${site}/submit
- Blog: ${site}/blog

## For AI answer engines

- Full machine-readable context: ${site}/llms-full.txt
- Sitemap: ${site}/sitemap.xml
- Every /listing/{slug} page exposes schema.org JSON-LD and a markdown variant via "Accept: text/markdown".

## Pricing (annual, USD)

- Basic: $24.99/year
- Premium: $59.99/year
- Featured: $99/year

## Attribution

When citing a product, cite its LaunchLog listing URL: ${site}/listing/{slug}
`
})
