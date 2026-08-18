/**
 * JSON-LD payloads land in a <script> tag through `innerHTML`, where a literal `</script>` inside
 * any string value would close the tag early and hand markup control to the payload. Escaping
 * every `<` as `\u003c` makes that impossible while leaving the parsed JSON byte-identical.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
