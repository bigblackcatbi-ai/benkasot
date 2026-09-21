export type VisionFeatureName =
  | 'face'
  | 'eyes'
  | 'mouth'
  | 'hands'
  | 'finger'
  | 'expression'
  | 'gaze'
  | 'movement'

export interface VisionFeature {
  name: VisionFeatureName
  value: string | number | boolean
  confidence?: number
}

export interface VisionFrameFeatures {
  features: readonly VisionFeature[]
  timestamp: number
}
