'use client'

import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FaceExpression = 'NO FACE' | 'NEUTRAL' | 'SURPRISED' | 'HAPPY' | 'SAD' | 'SMIRK' | 'TONGUE OUT'
export type EyeState = 'NO FACE' | 'OPEN' | 'CLOSED' | 'WINK LEFT' | 'WINK RIGHT'
export type MouthState = 'NO FACE' | 'OPEN' | 'CLOSED' | 'SMILE' | 'FROWN' | 'TONGUE OUT'
export type HeadDirection = 'NO FACE' | 'FORWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
export type HandGesture = 'OPEN PALM' | 'FIST' | 'THUMBS UP' | 'THUMBS DOWN' | 'POINTING' | 'PEACE' | 'THREE FINGERS' | 'FOUR FINGERS' | 'OK' | 'ROCK' | 'PINCH' | 'FINGER GUN' | 'UNKNOWN'

export interface HandGestureState { handedness: 'Left' | 'Right' | 'Hand'; gesture: HandGesture }

export interface FaceSignals {
  tongueOut: number
  smirk: number
  happy: number
  sad: number
  surprised: number
  neutral: number
  smile: number
  frown: number
  browDown: number
  browInnerUp: number
  eyeSquint: number
  eyeWide: number
  jawOpen: number
  mouthPress: number
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
  signals: FaceSignals
  visionConfidence: VisionConfidence
  baseline: VisionBaseline | null
}

type Blendshape = { categoryName: string; score: number }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const distance = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))
const avg = (...values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
const bs = (list: Blendshape[] | undefined, name: string) => list?.find(item => item.categoryName === name)?.score ?? 0

const emptySignals = (): FaceSignals => ({
  tongueOut: 0, smirk: 0, happy: 0, sad: 0, surprised: 0, neutral: 1,
  smile: 0, frown: 0, browDown: 0, browInnerUp: 0, eyeSquint: 0, eyeWide: 0, jawOpen: 0, mouthPress: 0,
})

function noFaceState(): Omit<VisionAnalysisState, 'handGestures'> {
  return {
    facePresent: false,
    faceExpression: 'NO FACE',
    eyes: 'NO FACE',
    mouth: 'NO FACE',
    headDirection: 'NO FACE',
    signals: emptySignals(),
    visionConfidence: { face: 0, expression: 0, eyes: 0, mouth: 0, headDirection: 0, hands: [] },
    baseline: null,
  }
}

let tongueCanvas: HTMLCanvasElement | null = null

function detectTonguePixels(video: HTMLVideoElement | null, face: NormalizedLandmark[] | undefined): number {
  if (!video || !face || video.readyState < 2 || face.length < 400 || typeof document === 'undefined') return 0

  const left = face[61], right = face[291], upper = face[13], lower = face[14]
  if (!left || !right || !upper || !lower) return 0

  const mouthWidth = Math.max(distance(left, right), 0.001)
  const mouthOpen = distance(upper, lower) / mouthWidth
  if (mouthOpen < 0.16) return 0

  const canvas = tongueCanvas ?? (tongueCanvas = document.createElement('canvas'))
  canvas.width = 48
  canvas.height = 32
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0

  const vw = video.videoWidth, vh = video.videoHeight
  if (!vw || !vh) return 0

  const cx = ((left.x + right.x) / 2) * vw
  const cy = ((upper.y + lower.y) / 2) * vh + mouthOpen * vh * 0.10
  const w = mouthWidth * vw * 0.82
  const h = Math.max(10, mouthOpen * vh * 1.35)

  try {
    ctx.drawImage(video, cx - w / 2, cy - h / 2, w, h, 0, 0, 48, 32)
    const pixels = ctx.getImageData(0, 0, 48, 32).data
    let pink = 0
    let samples = 0

    for (let y = 12; y < 31; y += 2) {
      for (let x = 10; x < 39; x += 2) {
        const i = (y * 48 + x) * 4
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2]
        const saturation = Math.max(r, g, b) - Math.min(r, g, b)
        // Tongue/lip pink is warmer and more saturated than the dark mouth cavity.
        if (r > 105 && r > g * 1.18 && g > b * 1.05 && saturation > 28) pink++
        samples++
      }
    }

    return clamp01((pink / Math.max(samples, 1) - 0.10) / 0.28)
  } catch {
    return 0
  }
}
function buildSignals(blendshapes: Blendshape[] | undefined, pixelTongue: number): FaceSignals {
  const smileL = bs(blendshapes, 'mouthSmileLeft')
  const smileR = bs(blendshapes, 'mouthSmileRight')
  const frownL = bs(blendshapes, 'mouthFrownLeft')
  const frownR = bs(blendshapes, 'mouthFrownRight')
  const browDown = avg(bs(blendshapes, 'browDownLeft'), bs(blendshapes, 'browDownRight'))
  const browInnerUp = bs(blendshapes, 'browInnerUp')
  const eyeSquint = avg(bs(blendshapes, 'eyeSquintLeft'), bs(blendshapes, 'eyeSquintRight'))
  const eyeWide = avg(bs(blendshapes, 'eyeWideLeft'), bs(blendshapes, 'eyeWideRight'))
  const jawOpen = bs(blendshapes, 'jawOpen')
  const mouthPress = avg(bs(blendshapes, 'mouthPressLeft'), bs(blendshapes, 'mouthPressRight'))
  const smile = avg(smileL, smileR)
  const frown = avg(frownL, frownR)
  const asymmetry = Math.abs(smileL - smileR) + Math.abs(frownL - frownR)
  const blendshapeTongue = bs(blendshapes, 'tongueOut')
  const tongueOut = Math.max(blendshapeTongue, pixelTongue)

  // These are independent evidence channels, not a single emotion classifier.
  // Each broad expression is assembled from the facial parts that support it.
  const smirk = clamp01((asymmetry - 0.12) / 0.35) * clamp01(Math.max(smile, 0.18) / 0.55)
  const happy = clamp01((smile * 1.35 + avg(bs(blendshapes, 'cheekSquintLeft'), bs(blendshapes, 'cheekSquintRight')) * 0.45 - frown * 0.5))
  const sad = clamp01(avg(browInnerUp * 1.15, frown * 1.35) * (1 - smile * 0.75))
  const surprised = clamp01(avg(eyeWide * 1.15, jawOpen * 1.25) * (1 - eyeSquint * 0.65))
  const neutral = clamp01(1 - Math.max(happy, sad, surprised, smirk, tongueOut) * 1.35)

  return {
    tongueOut, smirk, happy, sad, surprised, neutral,
    smile, frown, browDown, browInnerUp, eyeSquint, eyeWide, jawOpen, mouthPress,
  }
}

function classifyExpression(signals: FaceSignals): { expression: FaceExpression; confidence: number } {
  // Command priority: specific physical actions beat broad emotional states.
  // This is deliberately NOT a "which emotion is best" ranking.
  const candidates: Array<[FaceExpression, number]> = [
    ['TONGUE OUT', signals.tongueOut],
    ['SMIRK', signals.smirk],
    ['SURPRISED', signals.surprised],
    ['HAPPY', signals.happy],
    ['SAD', signals.sad],
    ['NEUTRAL', signals.neutral],
  ]

  const [expression, score] = candidates[0][1] >= 0.58
    ? candidates[0]
    : candidates.slice(1).sort((a, b) => b[1] - a[1])[0]

  return { expression, confidence: clamp01(score) }
}

function analyzeFace(
  face: NormalizedLandmark[] | undefined,
  blendshapes: Blendshape[] | undefined,
  video: HTMLVideoElement | null,
  baseline: VisionBaseline | null,
) {
  if (!face || face.length < 400) return noFaceState()

  const signals = buildSignals(blendshapes, detectTonguePixels(video, face))
  const leftEyeWidth = distance(face[33], face[133])
  const rightEyeWidth = distance(face[362], face[263])
  const leftEyeOpen = distance(face[159], face[145]) / Math.max(leftEyeWidth, 0.001)
  const rightEyeOpen = distance(face[386], face[374]) / Math.max(rightEyeWidth, 0.001)
  const leftClosed = leftEyeOpen < 0.135
  const rightClosed = rightEyeOpen < 0.135
  const eyes: EyeState = leftClosed && !rightClosed ? 'WINK LEFT' : rightClosed && !leftClosed ? 'WINK RIGHT' : leftClosed ? 'CLOSED' : 'OPEN'
  const mouthWidth = distance(face[61], face[291])
  const mouthOpenRatio = distance(face[13], face[14]) / Math.max(mouthWidth, 0.001)
  const mouth: MouthState = signals.tongueOut >= 0.58 ? 'TONGUE OUT' : mouthOpenRatio > (baseline ? Math.max(0.18, baseline.mouthOpen + 0.10) : 0.245) ? 'OPEN' : signals.smile > 0.18 ? 'SMILE' : signals.frown > 0.16 ? 'FROWN' : 'CLOSED'

  const eyeConfidence = clamp01(avg(
    Math.abs(leftEyeOpen - 0.135) / 0.11,
    Math.abs(rightEyeOpen - 0.135) / 0.11,
  ))
  const mouthConfidence = clamp01(Math.max(signals.tongueOut, signals.smile, signals.frown, mouthOpenRatio / 0.4))
  const eyeCenterX = (face[33].x + face[263].x) / 2
  const eyeDistance = Math.max(distance(face[33], face[263]), 0.001)
  const xs = face.slice(0, 468).map(p => p.x), ys = face.slice(0, 468).map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const nose = face[1]
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

  const expression = classifyExpression(signals)
  return {
    facePresent: true,
    faceExpression: expression.expression,
    eyes,
    mouth,
    headDirection,
    signals,
    visionConfidence: {
      face: 1,
      expression: expression.confidence,
      eyes: eyeConfidence,
      mouth: mouthConfidence,
      headDirection: clamp01(Math.max(Math.abs(yawPosition - 0.41), Math.abs(yawPosition - 0.59), Math.abs(pitchPosition - 0.38), Math.abs(pitchPosition - 0.57)) * 2),
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
const fingerAngle = (a: NormalizedLandmark[], mcp: number, pip: number, tip: number) => angle(a[mcp], a[pip], a[tip])
function isExtended(hand: NormalizedLandmark[], mcp: number, pip: number, tip: number) {
  return fingerAngle(hand, mcp, pip, tip) > 155 && distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.02
}

function analyzeHand(hand: NormalizedLandmark[]): { gesture: HandGesture; confidence: number } {
  if (hand.length < 21) return { gesture: 'UNKNOWN', confidence: 0 }
  const fingerScore = (mcp: number, pip: number, tip: number) => {
    const bend = clamp01((fingerAngle(hand, mcp, pip, tip) - 135) / 30)
    const reach = clamp01((distance(hand[tip], hand[0]) / Math.max(distance(hand[pip], hand[0]), 0.001) - 0.98) / 0.12)
    return avg(bend, reach)
  }
  const f = [fingerScore(5,6,8), fingerScore(9,10,12), fingerScore(13,14,16), fingerScore(17,18,20)]
  const scores = { index: f[0], middle: f[1], ring: f[2], pinky: f[3], thumb: clamp01((distance(hand[4], hand[0]) / Math.max(distance(hand[3], hand[0]), 0.001) - 1) / 0.18) }
  const candidates: Array<{ gesture: HandGesture; confidence: number }> = []
  const push = (gesture: HandGesture, required: number[], forbidden: number[]) => {
    const values = [scores.index, scores.middle, scores.ring, scores.pinky, scores.thumb]
    const req = required.length ? Math.min(...required.map(i => values[i])) : 1
    const forb = forbidden.length ? Math.min(...forbidden.map(i => 1 - values[i])) : 1
    candidates.push({ gesture, confidence: clamp01(Math.min(req, forb)) })
  }
  push('OPEN PALM', [0,1,2,3,4], [])
  push('FOUR FINGERS', [0,1,2,3], [4])
  push('THREE FINGERS', [0,1,2], [3,4])
  push('PEACE', [0,1], [2,3,4])
  push('POINTING', [0], [1,2,3])
  push('ROCK', [3], [0,1,2])
  push('FIST', [], [0,1,2,3,4])
  push('FINGER GUN', [0,3,4], [1,2])
  candidates.push({ gesture: 'THUMBS UP', confidence: clamp01(Math.min(scores.thumb, clamp01((hand[2].y - hand[4].y - 0.035) / 0.10), 1 - Math.max(...f)) * 1.08) })
  candidates.push({ gesture: 'THUMBS DOWN', confidence: clamp01(Math.min(scores.thumb, clamp01((hand[4].y - hand[2].y - 0.045) / 0.12), 1 - Math.max(...f)) * 1.08) })
  candidates.push({ gesture: 'PINCH', confidence: clamp01(Math.min(clamp01((0.42 - distance(hand[4], hand[8]) / Math.max(distance(hand[0], hand[9]),0.001))/0.14), 1 - Math.max(...f))) })
  candidates.push({ gesture: 'OK', confidence: clamp01(Math.min(clamp01((0.48 - distance(hand[4], hand[8]) / Math.max(distance(hand[0], hand[9]),0.001))/0.18), f[1], f[2], f[3])) })
  candidates.sort((a,b)=>b.confidence-a.confidence)
  const best=candidates[0], second=candidates[1]
  if (!best || best.confidence < 0.48 || (second && best.confidence-second.confidence < 0.08)) return { gesture:'UNKNOWN', confidence:best?.confidence ?? 0.2 }
  return best
}

type FaceAnalysis = ReturnType<typeof analyzeFace>
type PendingFace = { expression: FaceExpression; expressionCount: number; eyes: EyeState; eyesCount: number; mouth: MouthState; mouthCount: number; head: HeadDirection; headCount: number }

function smoothFaceState(raw: FaceAnalysis, previous: FaceAnalysis | null, pending: PendingFace) {
  if (!raw.facePresent) {
    pending.expression = 'NO FACE'; pending.expressionCount = 0; pending.eyes = 'NO FACE'; pending.eyesCount = 0; pending.mouth = 'NO FACE'; pending.mouthCount = 0; pending.head = 'NO FACE'; pending.headCount = 0
    return raw
  }
  const base = previous ?? raw
  const settle = <T extends string>(value: T, key: 'expression'|'eyes'|'mouth'|'head', countKey: 'expressionCount'|'eyesCount'|'mouthCount'|'headCount', previousValue: T) => {
    if (value === pending[key]) pending[countKey] += 1
    else { pending[key] = value as never; pending[countKey] = 1 }
    return pending[countKey] >= 2 ? value : previousValue
  }
  return {
    ...raw,
    faceExpression: settle(raw.faceExpression,'expression','expressionCount',base.faceExpression),
    eyes: settle(raw.eyes,'eyes','eyesCount',base.eyes),
    mouth: settle(raw.mouth,'mouth','mouthCount',base.mouth),
    headDirection: settle(raw.headDirection,'head','headCount',base.headDirection),
  }
}

export function useExpressionGestureDetection(
  faceLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  faceBlendshapes: React.MutableRefObject<Array<Blendshape[]>>,
  handedness: React.MutableRefObject<string[]>,
  videoRef: React.MutableRefObject<HTMLVideoElement | null>,
  enabled: boolean,
) {
  const [state, setState] = useState<VisionAnalysisState>({ ...noFaceState(), handGestures: [] })
  const previousFaceRef = useRef<FaceAnalysis | null>(null)
  const pendingFaceRef = useRef<PendingFace>({ expression:'NO FACE', expressionCount:0, eyes:'NO FACE', eyesCount:0, mouth:'NO FACE', mouthCount:0, head:'NO FACE', headCount:0 })
  const handGestureRef = useRef<HandGestureState[]>([])
  const pendingHandRef = useRef<Array<{ gesture: HandGesture; count: number }>>([])
  const baselineRef = useRef<VisionBaseline | null>(null)
  const neutralSinceRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setState({ ...noFaceState(), handGestures: [] })
      previousFaceRef.current = null
      baselineRef.current = null
      neutralSinceRef.current = 0
      pendingFaceRef.current = { expression:'NO FACE', expressionCount:0, eyes:'NO FACE', eyesCount:0, mouth:'NO FACE', mouthCount:0, head:'NO FACE', headCount:0 }
      handGestureRef.current = []
      pendingHandRef.current = []
      return
    }

    const update = () => {
      const rawFaceState = analyzeFace(faceLandmarks.current[0], faceBlendshapes.current[0], videoRef.current, baselineRef.current)
      const rawFace = faceLandmarks.current[0]

      if (rawFace && rawFace.length >= 400 && rawFaceState.faceExpression === 'NEUTRAL') {
        if (!neutralSinceRef.current) neutralSinceRef.current = performance.now()
        if (performance.now() - neutralSinceRef.current >= 700 && !baselineRef.current) {
          const map: Record<string, number> = {}
          faceBlendshapes.current[0]?.forEach(shape => { map[shape.categoryName] = shape.score })
          baselineRef.current = {
            eyeOpen: avg(distance(rawFace[159],rawFace[145]) / Math.max(distance(rawFace[33],rawFace[133]),0.001), distance(rawFace[386],rawFace[374]) / Math.max(distance(rawFace[362],rawFace[263]),0.001)),
            mouthOpen: distance(rawFace[13],rawFace[14]) / Math.max(distance(rawFace[61],rawFace[291]),0.001),
            smileOffset: 0,
            blendshapes: map,
          }
        }
      } else neutralSinceRef.current = 0

      const faceState = smoothFaceState(rawFaceState, previousFaceRef.current, pendingFaceRef.current)
      previousFaceRef.current = faceState

      const rawHands = handLandmarks.current.map((hand,index)=>({ handedness:(handedness.current[index] as HandGestureState['handedness']) || 'Hand', ...analyzeHand(hand) }))
      const handGestures = rawHands.map((hand,index)=>{
        const previous=handGestureRef.current[index]
        const pending=pendingHandRef.current[index] ?? { gesture:hand.gesture,count:0 }
        if(hand.gesture===pending.gesture) pending.count+=1; else {pending.gesture=hand.gesture;pending.count=1}
        pendingHandRef.current[index]=pending
        return !previous || pending.count>=2 ? hand : previous
      })
      handGestureRef.current=handGestures
      pendingHandRef.current.length=handGestures.length

      setState({
        ...faceState,
        handGestures,
        baseline: baselineRef.current,
        visionConfidence: { ...faceState.visionConfidence, hands: rawHands.map(h=>h.confidence) },
      })
    }

    update()
    const interval = window.setInterval(update, 100)
    return () => window.clearInterval(interval)
  }, [enabled, faceLandmarks, handLandmarks, faceBlendshapes, handedness, videoRef])

  return state
}
