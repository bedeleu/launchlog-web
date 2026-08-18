import { describe, expect, test } from 'bun:test'
import { serializeJsonLd } from './json-ld'

describe('serializeJsonLd', () => {
  test('never emits a literal closing script tag', () => {
    const out = serializeJsonLd({ name: 'Evil </script><script>alert(1)</script>' })

    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c/script>')
  })

  test('escapes every < so the payload cannot open markup', () => {
    expect(serializeJsonLd({ a: '<b>', b: ['<', { c: '<<' }] })).not.toContain('<')
  })

  test('parses back to the exact input value', () => {
    const value = { name: '</script>', nested: { html: '<img src=x>' }, list: ['<', 1, true, null] }

    expect(JSON.parse(serializeJsonLd(value))).toEqual(value)
  })
})
