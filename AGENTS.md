# AGENTS.md — LaunchLog Web

Nuxt 4 SSR frontend for LaunchLog, deployed as `launchlog.ai`.

Use the root workspace docs as product context:
- `../PRD-MVP.md` for product scope
- `../BRAND-GUIDELINES.md` for copy and visual tone
- `../AGENTS.md` for operating rules
- `../DECISIONS-LOG.md` for stack overrides

Current stack:
- Nuxt 4
- Vue 3 Composition API
- TypeScript
- Bun package manager
- Tailwind CSS
- Shadcn-Vue when UI components are added
- Pinia
- Firebase client SDK
- VeeValidate + Zod 3

Implementation rules:
- Use Nuxt 4 app directory conventions.
- Public pages must be SSR-friendly.
- Listing pages must render schema.org JSON-LD and support markdown content negotiation.
- Use Nuxt native SEO APIs and explicit JSON-LD components. Do not add `@nuxtjs/seo` until its Nuxt 4 peer dependencies are clean.
- Keep UI dark-first with LaunchLog palette.
- Product copy must stay direct and maker-focused.

Verification:
- Run `bun run build` before handing off frontend changes.
- Use browser verification after substantial UI changes.
