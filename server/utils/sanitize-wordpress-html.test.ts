import { describe, expect, test } from 'bun:test'
import { sanitizeWordPressHtml } from './sanitize-wordpress-html'

const BASE = 'https://blog.launchlog.ai'

describe('sanitizeWordPressHtml', () => {
  test('strips script, style, iframe and inline event handlers', () => {
    const html = '<p onclick="alert(1)">Safe</p>'
      + '<script>alert(1)</script>'
      + '<style>body{display:none}</style>'
      + '<iframe src="https://evil.test"></iframe>'
    const output = sanitizeWordPressHtml(html, BASE)

    expect(output).toContain('<p>Safe</p>')
    expect(output).not.toContain('onclick')
    expect(output).not.toContain('alert(1)')
    expect(output).not.toContain('<script')
    expect(output).not.toContain('<style')
    expect(output).not.toContain('display:none')
    expect(output).not.toContain('<iframe')
    expect(output).not.toContain('evil.test')
  })

  test('blocks javascript: and other disallowed link protocols', () => {
    const output = sanitizeWordPressHtml(
      '<a href="javascript:alert(1)">JsText</a>'
      + '<a href="data:text/html,ignored">DataText</a>'
      + '<a href="vbscript:msgbox(1)">VbText</a>',
      BASE,
    )

    expect(output).not.toContain('javascript:')
    expect(output).not.toContain('data:')
    expect(output).not.toContain('vbscript:')
    expect(output).not.toContain('href=')
    // The visible text survives; only the unsafe attribute is dropped.
    expect(output).toContain('JsText')
    expect(output).toContain('DataText')
    expect(output).toContain('VbText')
  })

  test('blocks disallowed image protocols including mailto and data', () => {
    const output = sanitizeWordPressHtml(
      '<img src="data:image/svg+xml,<svg onload=alert(1)>" alt="x">'
      + '<img src="mailto:a@b.test" alt="y">',
      BASE,
    )

    expect(output).not.toContain('data:')
    expect(output).not.toContain('mailto:')
    expect(output).not.toContain('src=')
  })

  test('allows mailto on links', () => {
    const output = sanitizeWordPressHtml('<a href="mailto:hello@launchlog.ai">Mail</a>', BASE)

    expect(output).toContain('href="mailto:hello@launchlog.ai"')
  })

  test('keeps editorial markup', () => {
    const html = '<h2>H2</h2><h3>H3</h3><h4>H4</h4>'
      + '<ul><li>one</li></ul><ol><li>two</li></ol>'
      + '<p><strong>bold</strong><em>italic</em></p>'
      + '<blockquote>quote</blockquote>'
      + '<pre><code class="language-ts">const x = 1</code></pre>'
      + '<figure><img src="https://cdn.test/a.png" alt="A"><figcaption>Caption</figcaption></figure>'
      + '<br><hr>'
    const output = sanitizeWordPressHtml(html, BASE)

    for (const tag of ['h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'blockquote', 'pre', 'code', 'figure', 'figcaption']) {
      expect(output).toContain(`<${tag}`)
    }
    expect(output).toContain('<br')
    expect(output).toContain('<hr')
    expect(output).toContain('class="language-ts"')
    expect(output).toContain('const x = 1')
    expect(output).toContain('Caption')
  })

  test('drops markup outside the allowlist but keeps its text', () => {
    const output = sanitizeWordPressHtml('<div><span>kept text</span><form><input></form></div>', BASE)

    expect(output).not.toContain('<div')
    expect(output).not.toContain('<span')
    expect(output).not.toContain('<form')
    expect(output).not.toContain('<input')
    expect(output).toContain('kept text')
  })

  test('resolves root-relative and document-relative URLs against the base', () => {
    const output = sanitizeWordPressHtml(
      '<p><a href="/guide">Guide</a><img src="/cover.jpg" alt="Cover"></p>'
      + '<a href="posts/hello">Hello</a>',
      BASE,
    )

    expect(output).toContain('href="https://blog.launchlog.ai/guide"')
    expect(output).toContain('src="https://blog.launchlog.ai/cover.jpg"')
    expect(output).toContain('href="https://blog.launchlog.ai/posts/hello"')
  })

  test('keeps valid absolute URLs on a different host', () => {
    const output = sanitizeWordPressHtml(
      '<a href="https://launchlog.ai/pricing">Pricing</a><img src="https://cdn.test/a.png" alt="A">',
      BASE,
    )

    expect(output).toContain('href="https://launchlog.ai/pricing"')
    expect(output).toContain('src="https://cdn.test/a.png"')
  })

  test('adds rel on links and lazy loading on images', () => {
    const output = sanitizeWordPressHtml(
      '<a href="/guide">Guide</a><img src="/cover.jpg" alt="Cover">',
      BASE,
    )

    expect(output).toContain('rel="noopener noreferrer"')
    expect(output).toContain('loading="lazy"')
    expect(output).toContain('decoding="async"')
  })

  test('keeps allowed attributes and drops the rest', () => {
    const output = sanitizeWordPressHtml(
      '<a href="/g" title="T" target="_blank" data-x="1">G</a>'
      + '<img src="/c.jpg" alt="A" width="800" height="600" srcset="/c-2x.jpg 2x">',
      BASE,
    )

    expect(output).toContain('title="T"')
    expect(output).toContain('alt="A"')
    expect(output).toContain('width="800"')
    expect(output).toContain('height="600"')
    expect(output).not.toContain('target=')
    expect(output).not.toContain('data-x')
    expect(output).not.toContain('srcset')
  })

  test('handles empty input without throwing', () => {
    expect(sanitizeWordPressHtml('', BASE)).toBe('')
  })

  test('drops unparsable URLs without throwing', () => {
    const output = sanitizeWordPressHtml('<a href="http://[unclosed">LinkText</a>', BASE)

    expect(output).not.toContain('[unclosed')
    expect(output).not.toContain('href=')
    expect(output).toContain('LinkText')
  })

  test('preserves table structure', () => {
    const html = '<figure class="wp-block-table"><table><thead><tr><th>Head</th></tr></thead>'
      + '<tbody><tr><td>Cell</td></tr></tbody></table></figure>'
    const output = sanitizeWordPressHtml(html, BASE)

    for (const tag of ['table', 'thead', 'tbody', 'tr', 'th', 'td']) {
      expect(output).toContain(`<${tag}>`)
      expect(output).toContain(`</${tag}>`)
    }
    expect(output).toContain('<th>Head</th>')
    expect(output).toContain('<td>Cell</td>')
  })

  test('keeps YouTube embeds with their playback attributes', () => {
    const html = '<figure class="wp-block-embed">'
      + '<iframe loading="lazy" title="Video" width="640" height="360"'
      + ' src="https://www.youtube.com/embed/XH3RYiaowOM?feature=oembed" frameborder="0"'
      + ' allow="accelerometer; autoplay; encrypted-media"'
      + ' referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></figure>'
    const output = sanitizeWordPressHtml(html, BASE)

    expect(output).toContain('<iframe')
    expect(output).toContain('src="https://www.youtube.com/embed/XH3RYiaowOM?feature=oembed"')
    expect(output).toContain('title="Video"')
    expect(output).toContain('width="640"')
    expect(output).toContain('height="360"')
    expect(output).toContain('loading="lazy"')
    expect(output).toContain('frameborder="0"')
    expect(output).toContain('allow="accelerometer; autoplay; encrypted-media"')
    expect(output).toContain('referrerpolicy="strict-origin-when-cross-origin"')
    expect(output).toContain('allowfullscreen')
  })

  test('removes an iframe from any other host', () => {
    const output = sanitizeWordPressHtml('<iframe src="https://evil.test/embed"></iframe>', BASE)

    expect(output).not.toContain('<iframe')
    expect(output).not.toContain('evil.test')
  })

  test('removes non-https and look-alike YouTube iframes', () => {
    const output = sanitizeWordPressHtml(
      '<iframe src="http://www.youtube.com/embed/x"></iframe>'
      + '<iframe src="https://www.youtube.com.evil.test/embed/x"></iframe>'
      + '<iframe src="https://evil.test/?u=www.youtube.com"></iframe>',
      BASE,
    )

    expect(output).not.toContain('<iframe')
    expect(output).not.toContain('evil.test')
  })

  test('drops disallowed attributes from a YouTube iframe', () => {
    const output = sanitizeWordPressHtml(
      '<iframe src="https://www.youtube.com/embed/x" onload="alert(1)" sandbox="allow-scripts" srcdoc="<b>x</b>"></iframe>',
      BASE,
    )

    expect(output).toContain('<iframe')
    expect(output).not.toContain('onload')
    expect(output).not.toContain('alert(1)')
    expect(output).not.toContain('sandbox')
    expect(output).not.toContain('srcdoc')
  })
})
