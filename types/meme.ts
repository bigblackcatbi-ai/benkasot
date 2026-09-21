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
  | 'closed'
  | 'wink-left'
  | 'wink-right'
  | 'neutral'
  | 'open'
  | 'frown'
  | 'excited'
  | 'smiling'
  | 'crying'
  | 'upward'
  | 'downward'
  | 'left'
  | 'right'
  | 'hands-on-head'
  | 'both-hands-near-head'
  | 'fist'
  | 'index-finger-to-chest'
  | 'index-finger-near-mouth'
  | 'index-finger-near-head'
  | 'hand-on-head'
  | 'both-hands-near-left-chest'
  | 'celebratory'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'smirk'
  | 'open-palm'
  | 'thumbs-up'
  | 'thumbs-down'
  | 'pointing'
  | 'peace'
  | 'three-fingers'
  | 'four-fingers'
  | 'ok'
  | 'rock'
  | 'pinch'
  | 'finger-gun'
  | 'unknown-gesture'

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
