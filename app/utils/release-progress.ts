export type ReleaseProgressStep = 'validate' | 'read' | 'capture' | 'prepare' | 'ready' | 'blocked'

export interface ReleaseProgress {
  step: ReleaseProgressStep
  completed: number
  label: string
  detail: string
}

type PreviewStatus = 'generating' | 'ready' | 'failed' | 'converted' | 'expired'

export function releaseProgress(
  status: PreviewStatus,
  hasScreenshot: boolean,
  slow: boolean,
): ReleaseProgress {
  if (status === 'converted') {
    return {
      step: 'ready',
      completed: 5,
      label: 'Release published',
      detail: 'The listing is now part of the public catalog.',
    }
  }

  if (status === 'ready') {
    return {
      step: 'ready',
      completed: 5,
      label: 'Release ready',
      detail: 'Review the evidence and choose a placement.',
    }
  }

  if (status === 'failed') {
    return {
      step: 'blocked',
      completed: 0,
      label: 'Capture needs attention',
      detail: 'The website could not be prepared for review.',
    }
  }

  if (status === 'expired') {
    return {
      step: 'blocked',
      completed: 0,
      label: 'Private preview expired',
      detail: 'Start a new capture to prepare this release again.',
    }
  }

  if (hasScreenshot) {
    return {
      step: 'prepare',
      completed: 4,
      label: 'Preparing the release',
      detail: 'Combining the capture with listing details.',
    }
  }

  if (slow) {
    return {
      step: 'capture',
      completed: 3,
      label: 'Capture is taking longer',
      detail: 'Your private preview is still processing.',
    }
  }

  return {
    step: 'read',
    completed: 2,
    label: 'Reading the website',
    detail: 'Collecting public copy and release facts.',
  }
}
