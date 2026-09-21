import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export interface LearnedGestureProfile {
  id: string
  name: string
  createdAt: number
  handedness: 'Left' | 'Right' | 'Any'
  landmarks: Array<{ x: number; y: number; z: number }>
  sampleCount: number
}
