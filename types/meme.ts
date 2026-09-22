export type MemeCategory = 'face' | 'hand' | 'movement' | 'combination'

export type MemeTriggerType = 'expression' | 'gesture' | 'movement' | 'combined'

export type MemeConditionFeature =
  | 'eyes'
  | 'mouth'
  | 'hands'
  | 'finger'
  | 'expression'
  | 'gaze'
  | 'movement'

export type MemeConditionCategory = 'face' | 'hand' | 'movement'

export type MemeConditionValue =
  | 'squinting'
  | 'wide'
  | 'open'
  | 'closed'
  | 'smiling'
  | 'happy'
  | 'sad'
  | 'surprised'
  | 'smirk'
  | 'neutral'
  | 'upward'
  | 'right'
  | 'left'
  | 'down'
  | 'hands-on-head'
  | 'both-hands-near-head'
  | 'hand-on-head'
  | 'hand-on-chest'
  | 'salute'
  | 'fist'
  | 'open-palm'
  | 'thumbs-up'
  | 'thumbs-down'
  | 'pointing-up'
  | 'peace'
  | 'ok'
  | 'three-fingers'
  | 'index-finger-near-mouth'
  | 'index-finger-near-head'
  | 'index-finger-to-chest'

export interface MemeCondition {
  feature: MemeConditionFeature
  category: MemeConditionCategory
  value: MemeConditionValue
  threshold?: number
  required: boolean
  enabled?: boolean
}

export interface MemeTrigger {
  type: MemeTriggerType
  conditions: readonly MemeCondition[]
}

export type MemeAnchor = 'face' | 'eyes' | 'head' | 'body' | 'custom'

export type MemeAnimation = 'none' | 'pop' | 'shake' | 'bounce'

export interface MemeOverlay {
  anchor: MemeAnchor
  scale: number
  rotation: number
  offsetX: number
  offsetY: number
  opacity: number
  duration: number
  animation: MemeAnimation
}

export type MemeSource = 'built-in' | 'custom'
export type MemeAccentColor = 'yellow' | 'pink' | 'blue' | 'mint' | 'orange'

export interface Meme {
  id: string
  name: string
  shortLabel: string
  description: string
  triggerSummary: string
  typeLabel: string
  imagePath: string
  category: MemeCategory
  enabled: boolean
  source: MemeSource
  accentColor: MemeAccentColor
  mockConfidence: number
  trigger: MemeTrigger
  overlay: MemeOverlay
}
