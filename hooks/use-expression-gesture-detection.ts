'use client'

import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FaceExpression = 'NO FACE' | 'NEUTRAL' | 'SURPRISED' | 'HAPPY' | 'SAD' | 'ANGRY' | 'SMIRK'
export type EyeState = 'NO FACE' | 'OPEN' | 'CLOSED' | 'WINK LEFT' | 'WINK RIGHT'
export type MouthState = 'NO FACE' | 'OPEN' | 'CLOSED' | 'SMILE' | 'FROWN'
export type HeadDirection = 'NO FACE' | 'FORWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
export type HandGesture = 'OPEN PALM' | 'FIST' | 'THUMBS UP' | 'THUMBS DOWN' | 'POINTING' | 'PEACE' | 'THREE FINGERS' | 'FOUR FINGERS' | 'OK' | 'ROCK' | 'PINCH' | 'FINGER GUN' | 'UNKNOWN'

export interface HandGestureState {
  handedness: 'Left' | 'Right' | 'Hand'
  gesture: HandGesture
}

export interface VisionConfidence {
  face: number
  expression: number
  eyes: number
  mouth: number
  headDirection: number
  hands: number[]
}

export interface VisionBaseline {
  eyeOpen: number
  mouthOpen: number
  smileOffset: number
  blendshapes: Record<string, number>
}

export interface VisionAnalysisState {
  facePresent: boolean
  faceExpression: FaceExpression
  eyes: EyeState
  mouth: MouthState
  headDirection: HeadDirection
  handGestures: HandGestureState[]
  visionConfidence: VisionConfidence
  baseline: VisionBaseline | null
}

type Blendshape = { categoryName: string; score: number }

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const thresholdConfidence = (value: number, threshold: number, scale: number) =>
  clamp01(Math.abs(value - threshold) / Math.max(scale, 0.001))

function noFaceState(): Omit<VisionAnalysisState, 'handGestures'> {
  return {
    facePresent: false,
    faceExpression: 'NO FACE',
    eyes: 'NO FACE',
    mouth: 'NO FACE',
    headDirection: 'NO FACE',
    visionConfidence: { face: 0, expression: 0, eyes: 0, mouth: 0, headDirection: 0, hands: [] },
    baseline: null,
  }
}

function analyzeFace(
  face: NormalizedLandmark[] | undefined,
  baseline: VisionBaseline | null,
  blendshapes: Blendshape[] | undefined,
  modelExpression: FaceExpression,
  modelConfidence: number,
) {
  if (!face || face.length < 400) return noFaceState()

  // MediaPipe landmarks/blendshapes are now auxiliary only. Emotion comes
  // from the dedicated facial-expression model passed in by the model hook.
  const leftEyeWidth = distance(face[33], face[133])
  const rightEyeWidth = distance(face[362], face[263])
  const leftEyeOpen = distance(face[159], face[145]) / Math.max(leftEyeWidth, 0.001)
  const rightEyeOpen = distance(face[386], face[374]) / Math.max(rightEyeWidth, 0.001)
  const leftClosed = leftEyeOpen < 0.135
  const rightClosed = rightEyeOpen < 0.135
  const eyes: EyeState =
    leftClosed && !rightClosed ? 'WINK LEFT' :
    rightClosed && !leftClosed ? 'WINK RIGHT' :
    leftClosed && rightClosed ? 'CLOSED' : 'OPEN'

  const eyeThreshold = baseline ? Math.max(0.11, baseline.eyeOpen * 0.68) : 0.135
  const eyeConfidence = clamp01(
    (thresholdConfidence(leftEyeOpen, eyeThreshold, 0.11) +
      thresholdConfidence(rightEyeOpen, eyeThreshold, 0.11)) / 2,
  )

  const mouthWidth = distance(face[61], face[291])
  const mouthOpenRatio = distance(face[13], face[14]) / Math.max(mouthWidth, 0.001)
  const mouthCornerY = (face[61].y + face[291].y) / 2
  const lipCenterY = (face[13].y + face[14].y) / 2
  const smileOffset = (lipCenterY - mouthCornerY) / Math.max(mouthWidth, 0.001)
  const expressionOffset = smileOffset - (baseline?.smileOffset ?? smileOffset)

  const mouthSmile = Math.max(
    0,
    (blendshapes?.find(shape => shape.categoryName === 'mouthSmileLeft')?.score ?? 0) -
      (baseline?.blendshapes?.mouthSmileLeft ?? 0),
  ) + Math.max(
    0,
    (blendshapes?.find(shape => shape.categoryName === 'mouthSmileRight')?.score ?? 0) -
      (baseline?.blendshapes?.mouthSmileRight ?? 0),
  )
  const mouthFrown = Math.max(
    0,
    (blendshapes?.find(shape => shape.categoryName === 'mouthFrownLeft')?.score ?? 0) -
      (baseline?.blendshapes?.mouthFrownLeft ?? 0),
  ) + Math.max(
    0,
    (blendshapes?.find(shape => shape.categoryName === 'mouthFrownRight')?.score ?? 0) -
      (baseline?.blendshapes?.mouthFrownRight ?? 0),
  )

  const mouthOpenThreshold = baseline ? Math.max(0.18, baseline.mouthOpen + 0.10) : 0.245
  const mouth: MouthState =
    mouthOpenRatio > mouthOpenThreshold ? 'OPEN' :
    expressionOffset > 0.048 || mouthSmile / 2 > 0.16 ? 'SMILE' :
    expressionOffset < -0.048 || mouthFrown / 2 > 0.12 ? 'FROWN' : 'CLOSED'

  const mouthConfidence = mouth === 'OPEN'
    ? thresholdConfidence(mouthOpenRatio, mouthOpenThreshold, 0.16)
    : mouth === 'SMILE'
      ? clamp01(Math.max(thresholdConfidence(expressionOffset, 0.048, 0.075), mouthSmile / 2 * 1.4))
      : mouth === 'FROWN'
        ? clamp01(Math.max(thresholdConfidence(expressionOffset, -0.048, 0.075), mouthFrown / 2 * 1.5))
        : 0.7

  const eyeCenterX = (face[33].x + face[263].x) / 2
  const eyeDistance = Math.max(distance(face[33], face[263]), 0.001)
  const nose = face[1]
  const faceX = face.slice(0, 468).map(point => point.x)
  const faceY = face.slice(0, 468).map(point => point.y)
  const minX = Math.min(...faceX)
  const maxX = Math.max(...faceX)
  const minY = Math.min(...faceY)
  const maxY = Math.max(...faceY)
  const yawPosition = (nose.x - minX) / Math.max(maxX - minX, 0.001)
  const pitchPosition = (nose.y - minY) / Math.max(maxY - minY, 0.001)

  let headDirection: HeadDirection = 'FORWARD'
  if (yawPosition < 0.41) headDirection = 'LEFT'
  else if (yawPosition > 0.59) headDirection = 'RIGHT'
  else if (pitchPosition < 0.38) headDirection = 'UP'
  else if (pitchPosition > 0.57) headDirection = 'DOWN'
  else {
    const yawOffset = (nose.x - eyeCenterX) / eyeDistance
    if (yawOffset < -0.14) headDirection = 'LEFT'
    else if (yawOffset > 0.14) headDirection = 'RIGHT'
  }

  const yawConfidence = clamp01(Math.max(
    thresholdConfidence(yawPosition, 0.41, 0.12),
    thresholdConfidence(yawPosition, 0.59, 0.12),
    thresholdConfidence(pitchPosition, 0.38, 0.14),
    thresholdConfidence(pitchPosition, 0.57, 0.14),
  ))

  return {
    facePresent: true,
    faceExpression: modelExpression,
    eyes,
    mouth,
    headDirection,
    visionConfidence: {
      face: 1,
      expression: modelConfidence,
      eyes: eyeConfidence,
      mouth: mouthConfidence,
      headDirection: yawConfidence,
      hands: [],
    },
    baseline,
  }
}

const angle = (a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) => {
  const abx = a.x - b.x, aby = a.y - b.y
  const cbx = c.x - b.x, cby = c.y - b.y
  const dot = abx * cbx + aby * cby
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby)
  return mag > 0 ? Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180 / Math.PI : 0
}

const fingerAngle = (a: NormalizedLandmark[], mcp: number, pip: number, tip: number) =>
  angle(a[mcp], a[pip], a[tip])

function isExtended(hand: NormalizedLandmark[], mcp: number, pip: number, tip: number) {
  return fingerAngle(hand, mcp, pip, tip) > 155 && distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.02
}

function analyzeHand(hand: NormalizedLandmark[]): { gesture: HandGesture; confidence: number } {
  if (hand.length < 21) return { gesture: 'UNKNOWN', confidence: 0 }

  const fingerExtensionScore = (mcp: number, pip: number, tip: number) => {
    const bend = (fingerAngle(hand, mcp, pip, tip) - 135) / 30
    const reach = (distance(hand[tip], hand[0]) / Math.max(distance(hand[pip], hand[0]), 0.001) - 0.98) / 0.12
    return clamp01((clamp01(bend) + clamp01(reach)) / 2)
  }
  const fingerScores = [
    fingerExtensionScore(5, 6, 8),
    fingerExtensionScore(9, 10, 12),
    fingerExtensionScore(13, 14, 16),
    fingerExtensionScore(17, 18, 20),
  ]
  const index = fingerScores[0] > 0.52
  const middle = fingerScores[1] > 0.52
  const ring = fingerScores[2] > 0.52
  const pinky = fingerScores[3] > 0.52
  const palmSize = Math.max(distance(hand[0], hand[9]), 0.001)
  const thumbReach = clamp01((distance(hand[4], hand[0]) / Math.max(distance(hand[3], hand[0]), 0.001) - 1) / 0.18)
  const thumbUpScore = clamp01((hand[2].y - hand[4].y - 0.035) / 0.10)
  const thumbDownScore = clamp01((hand[4].y - hand[2].y - 0.045) / 0.12)
  const thumbIndexGap = distance(hand[4], hand[8]) / palmSize
  const pinchScore = clamp01((0.42 - thumbIndexGap) / 0.14)
  const okScore = clamp01((0.48 - thumbIndexGap) / 0.18)
  const scores = { index: fingerScores[0], middle: fingerScores[1], ring: fingerScores[2], pinky: fingerScores[3], thumb: thumbReach }
  const candidates: Array<{ gesture: HandGesture; confidence: number }> = []
  const pushPattern = (gesture: HandGesture, required: number[], forbidden: number[], extra = 1) => {
    const requiredScore = required.length ? Math.min(...required.map(index => [scores.index, scores.middle, scores.ring, scores.pinky, scores.thumb][index])) : 1
    const forbiddenScore = forbidden.length ? Math.min(...forbidden.map(index => 1 - [scores.index, scores.middle, scores.ring, scores.pinky, scores.thumb][index])) : 1
    candidates.push({ gesture, confidence: clamp01(Math.min(requiredScore, forbiddenScore) * extra) })
  }
  pushPattern('OPEN PALM', [0, 1, 2, 3, 4], [])
  pushPattern('FOUR FINGERS', [0, 1, 2, 3], [4])
  pushPattern('THREE FINGERS', [0, 1, 2], [3, 4])
  pushPattern('PEACE', [0, 1], [2, 3, 4])
  pushPattern('POINTING', [0], [1, 2, 3])
  pushPattern('ROCK', [3], [0, 1, 2])
  pushPattern('FIST', [], [0, 1, 2, 3, 4])
  pushPattern('FINGER GUN', [0, 3, 4], [1, 2])
  candidates.push({ gesture: 'THUMBS UP', confidence: clamp01(Math.min(thumbReach, thumbUpScore, 1 - Math.max(...fingerScores)) * 1.08) })
  candidates.push({ gesture: 'THUMBS DOWN', confidence: clamp01(Math.min(thumbReach, thumbDownScore, 1 - Math.max(...fingerScores)) * 1.08) })
  candidates.push({ gesture: 'PINCH', confidence: clamp01(Math.min(pinchScore, 1 - Math.max(fingerScores))) })
  candidates.push({ gesture: 'OK', confidence: clamp01(Math.min(okScore, fingerScores[1], fingerScores[2], fingerScores[3])) })
  candidates.sort((a, b) => b.confidence - a.confidence)
  const best = candidates[0]
  const second = candidates[1]
  if (!best || best.confidence < 0.48 || (second && best.confidence - second.confidence < 0.08)) return { gesture: 'UNKNOWN', confidence: best?.confidence ?? 0.2 }
  return best
}

type FaceAnalysis = ReturnType<typeof analyzeFace>
type PendingFace = {
  expression: FaceExpression
  expressionCount: number
  eyes: EyeState
  eyesCount: number
  mouth: MouthState
  mouthCount: number
  head: HeadDirection
  headCount: number
}

function smoothFaceState(raw: FaceAnalysis, previous: FaceAnalysis | null, pending: PendingFace) {
  if (!raw.facePresent) {
    pending.expression = 'NO FACE'
    pending.expressionCount = 0
    pending.eyes = 'NO FACE'
    pending.eyesCount = 0
    pending.mouth = 'NO FACE'
    pending.mouthCount = 0
    pending.head = 'NO FACE'
    pending.headCount = 0
    return raw
  }
  const base = previous ?? raw
  const settle = <T extends string>(value: T, key: 'expression' | 'eyes' | 'mouth' | 'head', countKey: 'expressionCount' | 'eyesCount' | 'mouthCount' | 'headCount', previousValue: T) => {
    if (value === pending[key]) pending[countKey] += 1
    else { pending[key] = value as never; pending[countKey] = 1 }
    return pending[countKey] >= 2 ? value : previousValue
  }
  const stableExpression = raw.visionConfidence.expression >= 0.62
    ? settle(raw.faceExpression, 'expression', 'expressionCount', base.faceExpression)
    : base.faceExpression
  if (raw.faceExpression === base.faceExpression) {
    pending.expression = raw.faceExpression
    pending.expressionCount = Math.max(pending.expressionCount, 1)
  }
  return {
    facePresent: true,
    faceExpression: stableExpression,
    eyes: settle(raw.eyes, 'eyes', 'eyesCount', base.eyes),
    mouth: settle(raw.mouth, 'mouth', 'mouthCount', base.mouth),
    headDirection: settle(raw.headDirection, 'head', 'headCount', base.headDirection),
    visionConfidence: raw.visionConfidence,
    baseline: raw.baseline,
  }
}

export function useExpressionGestureDetection(
  faceLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  faceBlendshapes: React.MutableRefObject<Array<Blendshape[]>>,
  handedness: React.MutableRefObject<string[]>,
  modelExpression: React.MutableRefObject<{ expression: FaceExpression; confidence: number; probabilities: Record<string, number> }>,
  enabled: boolean,
) {
  const [state, setState] = useState<VisionAnalysisState>({ ...noFaceState(), handGestures: [] })
  const previousFaceRef = useRef<FaceAnalysis | null>(null)
  const pendingFaceRef = useRef<PendingFace>({ expression: 'NO FACE', expressionCount: 0, eyes: 'NO FACE', eyesCount: 0, mouth: 'NO FACE', mouthCount: 0, head: 'NO FACE', headCount: 0 })
  const handGestureRef = useRef<HandGestureState[]>([])
  const pendingHandRef = useRef<Array<{ gesture: HandGesture; count: number }>>([])
  const baselineRef = useRef<VisionBaseline | null>(null)
  const baselineSamplesRef = useRef<VisionBaseline[]>([])
  const neutralSinceRef = useRef(0)

  const smoothHandGestures = (raw: HandGestureState[]) => {
    const result = raw.map((hand, index) => {
      const previous = handGestureRef.current[index]
      const pending = pendingHandRef.current[index] ?? { gesture: hand.gesture, count: 0 }
      if (hand.gesture === pending.gesture) pending.count += 1
      else { pending.gesture = hand.gesture; pending.count = 1 }
      pendingHandRef.current[index] = pending
      return !previous || pending.count >= 2 ? hand : previous
    })
    handGestureRef.current = result
    pendingHandRef.current.length = result.length
    return result
  }

  useEffect(() => {
    if (!enabled) {
      setState({ ...noFaceState(), handGestures: [] })
      previousFaceRef.current = null
      baselineRef.current = null
      baselineSamplesRef.current = []
      neutralSinceRef.current = 0
      pendingFaceRef.current = { expression: 'NO FACE', expressionCount: 0, eyes: 'NO FACE', eyesCount: 0, mouth: 'NO FACE', mouthCount: 0, head: 'NO FACE', headCount: 0 }
      handGestureRef.current = []
      pendingHandRef.current = []
      return
    }

    const update = () => {
      const model = modelExpression.current
      const rawFaceState = analyzeFace(faceLandmarks.current[0], baselineRef.current, faceBlendshapes.current[0], model.expression, model.confidence)

      const rawFace = faceLandmarks.current[0]
      if (rawFace && rawFace.length >= 400 && rawFaceState.faceExpression === 'NEUTRAL') {
        if (!neutralSinceRef.current) neutralSinceRef.current = performance.now()
        if (performance.now() - neutralSinceRef.current >= 700 && !baselineRef.current) {
          const blendshapeMap: Record<string, number> = {}
          faceBlendshapes.current[0]?.forEach(shape => { blendshapeMap[shape.categoryName] = shape.score })
          const leftEyeWidth = distance(rawFace[33], rawFace[133])
          const rightEyeWidth = distance(rawFace[362], rawFace[263])
          baselineRef.current = {
            eyeOpen: (
              distance(rawFace[159], rawFace[145]) / Math.max(leftEyeWidth, 0.001) +
              distance(rawFace[386], rawFace[374]) / Math.max(rightEyeWidth, 0.001)
            ) / 2,
            mouthOpen: distance(rawFace[13], rawFace[14]) / Math.max(distance(rawFace[61], rawFace[291]), 0.001),
            smileOffset: ((rawFace[13].y + rawFace[14].y) / 2 - (rawFace[61].y + rawFace[291].y) / 2) / Math.max(distance(rawFace[61], rawFace[291]), 0.001),
            blendshapes: blendshapeMap,
          }
        }
      } else {
        neutralSinceRef.current = 0
      }

      const faceState = smoothFaceState(rawFaceState, previousFaceRef.current, pendingFaceRef.current)
      previousFaceRef.current = faceState

      const hands = handLandmarks.current
      const rawHands = hands.map((hand, index) => ({
        handedness: (handedness.current[index] as HandGestureState['handedness']) || 'Hand',
        ...analyzeHand(hand),
      }))
      const handGestures = smoothHandGestures(rawHands)

      const finalState: VisionAnalysisState = {
        ...faceState,
        handGestures,
        baseline: baselineRef.current,
        visionConfidence: {
          ...faceState.visionConfidence,
          hands: handGestures.map((_, index) => rawHands[index]?.confidence ?? 0),
        },
      }
      setState(finalState)
    }

    update()
    const interval = window.setInterval(update, 100)
    return () => window.clearInterval(interval)
  }, [enabled, faceLandmarks, handLandmarks, faceBlendshapes, handedness, modelExpression])

  return state
}
