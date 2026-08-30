import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createSSRApp, defineComponent, h } from 'vue'
import * as VueRuntime from 'vue'
import { renderToString } from '@vue/server-renderer'

const source = readFileSync(fileURLToPath(new URL('./ReleaseSelect.vue', import.meta.url)), 'utf8')
const descriptor = parse(source).descriptor
const template = descriptor.template?.content
if (!template) throw new Error('ReleaseSelect template is missing')

const compiledScript = compileScript(descriptor, { id: 'release-select-test' })
const transpiledScript = new Bun.Transpiler({ loader: 'ts' }).transformSync(compiledScript.content)
const executableScript = transpiledScript
  .replace(
    /import\s*{\s*defineComponent as _defineComponent\s*}\s*from\s*["']vue["'];?/,
    'const { defineComponent: _defineComponent, ref, computed, onMounted, onBeforeUnmount, useId } = VueRuntime;',
  )
  .replace(
    /import\s*{\s*Check,\s*ChevronDown\s*}\s*from\s*["']@lucide\/vue["'];?/,
    'const Check = Icon; const ChevronDown = Icon;',
  )
  .replace(
    /import\s*{\s*cn\s*}\s*from\s*["']@\/lib\/utils["'];?/,
    'const cn = (...values) => values.filter(Boolean).join(" ");',
  )
  .replace('export default', 'return')

const render = new Function('Vue', compile(template, {
  mode: 'function',
  prefixIdentifiers: true,
  bindingMetadata: compiledScript.bindings,
}).code)(VueRuntime)
const Icon = defineComponent({ render: () => h('span') })
const ReleaseSelect = new Function(
  'VueRuntime',
  'Icon',
  executableScript,
)(VueRuntime, Icon)
ReleaseSelect.render = render

describe('ReleaseSelect trigger association', () => {
  test('forwards the explicit trigger id to the focusable combobox button', async () => {
    const app = createSSRApp(ReleaseSelect, {
      triggerId: 'outreach-subject-variant',
      modelValue: 'preview',
      options: [{ value: 'preview', label: 'Preview-led' }],
      label: 'Choose outreach subject direction',
    })
    app.config.warnHandler = () => undefined

    const html = await renderToString(app)

    expect(html).toMatch(/^<div class="relative"><button[^>]*id="outreach-subject-variant"[^>]*role="combobox"/)
    expect(html).not.toMatch(/^<div[^>]*id="outreach-subject-variant"/)
  })
})
