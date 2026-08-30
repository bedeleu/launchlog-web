import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@vue/compiler-dom'
import { parse } from '@vue/compiler-sfc'
import { computed, createRenderer, defineComponent, h, nextTick, ref } from 'vue'

const source = readFileSync(fileURLToPath(new URL('./PreviewEditor.vue', import.meta.url)), 'utf8')
const placementPreview = readFileSync(fileURLToPath(new URL('./PlacementPreview.vue', import.meta.url)), 'utf8')
const previewPage = readFileSync(fileURLToPath(new URL('../../pages/preview/[token].vue', import.meta.url)), 'utf8')
const proposalReview = readFileSync(fileURLToPath(new URL('../Ai/ProposalReview.vue', import.meta.url)), 'utf8')
const template = parse(source).descriptor.template?.content
if (!template) throw new Error('PreviewEditor template is missing')

// The in-memory renderer has no CSS layout engine, so v-if models the same
// disclosure state as v-show. Strip only TypeScript syntax from the handler.
const runtimeTemplate = template
  .replace('v-show="open"', 'v-if="open"')
  .replace('($event.target as HTMLTextAreaElement).value', '$event.target.value')
const render = new Function('Vue', compile(runtimeTemplate, { mode: 'function' }).code)(await import('vue'))

interface TestNode {
  type: string
  props: Record<string, unknown>
  children: TestNode[]
  parent: TestNode | null
  text?: string
}

const node = (type: string, text?: string): TestNode => ({ type, props: {}, children: [], parent: null, text })
const renderer = createRenderer<TestNode, TestNode>({
  patchProp(element, key, _previous, next) {
    if (next === null || next === undefined) Reflect.deleteProperty(element.props, key)
    else element.props[key] = next
  },
  insert(child, parent, anchor) {
    child.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index === -1) parent.children.push(child)
    else parent.children.splice(index, 0, child)
  },
  remove(child) {
    if (!child.parent) return
    const index = child.parent.children.indexOf(child)
    if (index >= 0) child.parent.children.splice(index, 1)
    child.parent = null
  },
  createElement: type => node(type),
  createText: text => node('#text', text),
  createComment: text => node('#comment', text),
  setText(target, text) {
    target.text = text
  },
  setElementText(target, text) {
    const child = node('#text', text)
    child.parent = target
    target.children = [child]
  },
  parentNode: target => target.parent,
  nextSibling(target) {
    if (!target.parent) return null
    return target.parent.children[target.parent.children.indexOf(target) + 1] ?? null
  },
  querySelector: () => null,
  setScopeId: () => undefined,
  cloneNode: target => ({ ...target, props: { ...target.props }, children: [...target.children], parent: null }),
  insertStaticContent(content, parent, anchor) {
    const target = node('#static', content)
    target.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index === -1) parent.children.push(target)
    else parent.children.splice(index, 0, target)
    return [target, target]
  },
})

const findNode = (root: TestNode, predicate: (value: TestNode) => boolean): TestNode | undefined => {
  if (predicate(root)) return root
  for (const child of root.children) {
    const match = findNode(child, predicate)
    if (match) return match
  }
  return undefined
}

const textOf = (target: TestNode): string => target.text ?? target.children.map(textOf).join('')

const InputStub = defineComponent({
  inheritAttrs: false,
  props: { modelValue: { type: [String, Number], default: '' } },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      value: props.modelValue,
      onInput: (event: { target: { value: string } }) => emit('update:modelValue', event.target.value),
    })
  },
})

const LabelStub = defineComponent({
  inheritAttrs: false,
  setup(_props, { attrs, slots }) {
    return () => h('label', attrs, slots.default?.())
  },
})

const mountEditor = (initialOpen = false, initialTitle = 'LaunchLog') => {
  const root = node('root')
  const open = ref(initialOpen)
  const title = ref(initialTitle)
  const tagline = ref('The log of what just shipped.')
  const description = ref('A curated release catalog.')
  const events: Array<[string, unknown?]> = []
  const TITLE_LIMIT = 120
  const TAGLINE_LIMIT = 200
  const DESCRIPTION_LIMIT = 2000
  const boundedValue = (value: unknown, limit: number) => String(value).slice(0, limit)

  const app = renderer.createApp({
    render,
    setup: () => ({
      title,
      domain: 'launchlog.ai',
      tagline,
      description,
      open,
      hasScreenshot: true,
      recapturing: false,
      recaptureError: null,
      TITLE_LIMIT,
      TAGLINE_LIMIT,
      DESCRIPTION_LIMIT,
      boundedValue,
      titleError: computed(() => title.value.length > TITLE_LIMIT ? 'Title must be 120 characters or fewer.' : null),
      taglineError: computed(() => tagline.value.length > TAGLINE_LIMIT ? 'Tagline must be 200 characters or fewer.' : null),
      descriptionError: computed(() => description.value.length > DESCRIPTION_LIMIT ? 'Description must be 2,000 characters or fewer.' : null),
      emit: (event: string, value?: unknown) => {
        events.push([event, value])
        if (event === 'update:open') open.value = Boolean(value)
        if (event === 'update:title') title.value = String(value)
        if (event === 'update:tagline') tagline.value = String(value)
        if (event === 'update:description') description.value = String(value)
      },
    }),
  })
  app.config.warnHandler = () => undefined
  app.component('Input', InputStub)
  app.component('Label', LabelStub)
  app.mount(root)
  return { root, open, title, tagline, description, events }
}

describe('PreviewEditor', () => {
  test('opens the controlled region from the labelled disclosure button', async () => {
    const harness = mountEditor()
    const toggle = findNode(harness.root, target => target.props.id === 'preview-editor-toggle')

    expect(toggle?.props['aria-expanded']).toBe(false)
    expect(toggle?.props['aria-controls']).toBe('preview-editor-panel')
    expect(findNode(harness.root, target => target.props.id === 'preview-editor-panel')).toBeUndefined()

    ;(toggle?.props.onClick as () => void)()
    await nextTick()

    expect(harness.open.value).toBe(true)
    expect(harness.events).toContainEqual(['update:open', true])
    const panel = findNode(harness.root, target => target.props.id === 'preview-editor-panel')
    expect(panel?.props.role).toBe('region')
    expect(panel?.props['aria-labelledby']).toBe('preview-editor-toggle')
  })

  test('enforces field ceilings during input and keeps visible counters in sync', async () => {
    const harness = mountEditor(true)
    const titleInput = findNode(harness.root, target => target.props.id === 'f-title')
    const descriptionInput = findNode(harness.root, target => target.props.id === 'f-description')

    expect(titleInput?.props.maxlength).toBe(120)
    expect(descriptionInput?.props.maxlength).toBe(2000)
    ;(titleInput?.props.onInput as (event: { target: { value: string } }) => void)({ target: { value: 'T'.repeat(140) } })
    ;(descriptionInput?.props.onInput as (event: { target: { value: string } }) => void)({ target: { value: 'D'.repeat(2100) } })
    await nextTick()

    expect(harness.title.value).toHaveLength(120)
    expect(harness.description.value).toHaveLength(2000)
    expect(textOf(findNode(harness.root, target => target.props.id === 'f-title-count')!)).toContain('120 / 120')
    expect(textOf(findNode(harness.root, target => target.props.id === 'f-description-count')!)).toContain('2000 / 2,000')
  })

  test('announces over-limit crawl data without hiding the editor', () => {
    const harness = mountEditor(true, 'T'.repeat(121))
    const titleInput = findNode(harness.root, target => target.props.id === 'f-title')
    const error = findNode(harness.root, target => target.props.id === 'f-title-error')

    expect(titleInput?.props['aria-invalid']).toBe(true)
    expect(titleInput?.props['aria-describedby']).toContain('f-title-error')
    expect(error?.props.role).toBe('alert')
    expect(textOf(error!)).toContain('120 characters or fewer')
  })

  test('keeps listing editing secondary and removes the public-preview AI action', () => {
    expect(source).toContain('data-preview-editor')
    expect(placementPreview).not.toContain('Listing title')
    expect(placementPreview).not.toContain('Short description')
    expect(source).not.toMatch(/Improve draft with AI|aiBusy|aiError|aiSuggestion|AiProposalReview/)
    expect(previewPage).not.toMatch(/PreviewAiSuggestion|suggestPreview|aiSuggestion|generateAiSuggestion|acceptAiSuggestion|@improve|@apply|@reject/)
    expect(proposalReview).not.toContain("'preview'")
    expect(source).not.toMatch(/violet|purple|indigo|mauve|linear-gradient/i)
  })
})
