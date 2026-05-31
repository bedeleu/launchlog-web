// server/routes/robots.txt.get.ts
// Dynamic robots.txt — explicitly allows AI crawlers while blocking private routes.
export default defineEventHandler((event) => {
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  const site = getSiteUrl()
  const disallow = ['/admin', '/dashboard', '/login', '/checkout', '/preview']
  const aiBots = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-Web',
    'PerplexityBot',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
  ]
  const blocks: string[] = []
  blocks.push('User-agent: *', 'Allow: /')
  for (const d of disallow) blocks.push(`Disallow: ${d}`)
  blocks.push('')
  for (const bot of aiBots) {
    blocks.push(`User-agent: ${bot}`, 'Allow: /')
    for (const d of disallow) blocks.push(`Disallow: ${d}`)
    blocks.push('')
  }
  blocks.push(`Sitemap: ${site}/sitemap.xml`, `# AI context: ${site}/llms.txt`)
  return blocks.join('\n') + '\n'
})
