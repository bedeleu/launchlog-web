import { describe, expect, it } from 'bun:test'
import { releaseProgress } from './release-progress'

describe('releaseProgress', () => {
  it('reads a generating website before a capture exists', () => {
    expect(releaseProgress('generating', false, false)).toEqual({
      step: 'read',
      completed: 2,
      label: 'Reading the website',
      detail: 'Collecting public copy and release facts.',
    })
  })

  it('prepares the release after the screenshot arrives', () => {
    expect(releaseProgress('generating', true, false)).toEqual({
      step: 'prepare',
      completed: 4,
      label: 'Preparing the release',
      detail: 'Combining the capture with listing details.',
    })
  })

  it('reports a slow capture without inventing a percentage', () => {
    expect(releaseProgress('generating', false, true)).toEqual({
      step: 'capture',
      completed: 3,
      label: 'Capture is taking longer',
      detail: 'Your private preview is still processing.',
    })
  })

  it('maps ready and converted previews to the completed record', () => {
    expect(releaseProgress('ready', true, false)).toEqual({
      step: 'ready',
      completed: 5,
      label: 'Release ready',
      detail: 'Review the evidence and choose a placement.',
    })
    expect(releaseProgress('converted', true, false)).toEqual({
      step: 'ready',
      completed: 5,
      label: 'Release published',
      detail: 'The listing is now part of the public catalog.',
    })
  })

  it('maps failed and expired previews to terminal blocked states', () => {
    expect(releaseProgress('failed', false, false)).toEqual({
      step: 'blocked',
      completed: 0,
      label: 'Capture needs attention',
      detail: 'The website could not be prepared for review.',
    })
    expect(releaseProgress('expired', false, false)).toEqual({
      step: 'blocked',
      completed: 0,
      label: 'Private preview expired',
      detail: 'Start a new capture to prepare this release again.',
    })
  })

  it('advances monotonically through observable generation states', () => {
    const completed = [
      releaseProgress('generating', false, false),
      releaseProgress('generating', false, true),
      releaseProgress('generating', true, false),
      releaseProgress('ready', true, false),
    ].map(progress => progress.completed)

    expect(completed).toEqual([2, 3, 4, 5])
  })
})
