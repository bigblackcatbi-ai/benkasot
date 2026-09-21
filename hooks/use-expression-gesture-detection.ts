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

export interface VisionAnalysisState {
  facePresent: boolean
  faceExpression: FaceExpression
  eyes: EyeState
  mouth: MouthState
  headDirection: HeadDirection
  handGestures: HandGestureState[]
}

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))

function noFaceState() {
  return {
    facePresent: false,
    faceExpression: 'NO FACE' as FaceExpression,
    eyes: 'NO FACE' as EyeState,
    mouth: 'NO FACE' as MouthState,
    headDirection: 'NO FACE' as HeadDirection,
  }
}

function analyzeFace(face: NormalizedLandmark[] | undefined) {
  if (!face || face.length < 400) return noFaceState()

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

  const mouthWidth = distance(face[61], face[291])
  const mouthOpenRatio = distance(face[13], face[14]) / Math.max(mouthWidth, 0.001)
  const mouthCornerY = (face[61].y + face[291].y) / 2
  const lipCenterY = (face[13].y + face[14].y) / 2
  const smileOffset = (lipCenterY - mouthCornerY) / Math.max(mouthWidth, 0.001)
  const smile = smileOffset > 0.048
  const frown = smileOffset < -0.048
  const mouth: MouthState =
    mouthOpenRatio > 0.245 ? 'OPEN' :
    smile ? 'SMILE' :
    frown ? 'FROWN' : 'CLOSED'

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

  const browLeft = face[105].y - face[159].y
  const browRight = face[334].y - face[386].y
  const browDown = browLeft > -0.055 && browRight > -0.055
  const angry = browDown && eyes === 'CLOSED' && mouth !== 'SMILE'
  const happy = mouth === 'SMILE'
  const sad = mouth === 'FROWN'
  const surprised = eyes === 'OPEN' && mouth === 'OPEN'
  const asymmetry = Math.abs((face[61].y - face[291].y) / Math.max(mouthWidth, 0.001))
  const faceExpression: FaceExpression =
    surprised ? 'SURPRISED' :
    angry ? 'ANGRY' :
    happy ? 'HAPPY' :
    sad ? 'SAD' :
    asymmetry > 0.14 ? 'SMIRK' : 'NEUTRAL'

  return { facePresent: true, faceExpression, eyes, mouth, headDirection }
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

const isExtended = (hand: NormalizedLandmark[], mcp: number, pip: number, tip: number) =>
  fingerAngle(hand, mcp, pip, tip) > 155 && distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.02

function analyzeHand(hand: NormalizedLandmark[]): HandGesture {
  if (hand.length < 21) return 'UNKNOWN'

  const index = isExtended(hand, 5, 6, 8)
  const middle = isExtended(hand, 9, 10, 12)
  const ring = isExtended(hand, 13, 14, 16)
  const pinky = isExtended(hand, 17, 18, 20)
  const thumbExtended = distance(hand[4], hand[0]) > distance(hand[3], hand[0]) * 1.02
  const thumbUp = hand[4].y < hand[2].y - 0.06
  const thumbDown = hand[4].y > hand[2].y + 0.08
  const palmSize = Math.max(distance(hand[0], hand[9]), 0.001)
  const thumbIndexGap = distance(hand[4], hand[8]) / palmSize
  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length

  if (thumbIndexGap < 0.42 && middle && ring && pinky) return 'OK'
  if (thumbIndexGap < 0.34 && !middle && !ring && !pinky) return 'PINCH'
  if (thumbUp && thumbExtended && extendedCount === 0) return 'THUMBS UP'
  if (thumbDown && thumbExtended && extendedCount === 0) return 'THUMBS DOWN'
  if (index && !middle && !ring && pinky && thumbExtended) return 'FINGER GUN'
  if (!index && !middle && !ring && pinky) return 'ROCK'
  if (index && middle && ring && pinky) return thumbExtended ? 'OPEN PALM' : 'FOUR FINGERS'
  if (index && middle && ring && !pinky) return 'THREE FINGERS'
  if (index && middle && !ring && !pinky) return 'PEACE'
  if (index && !middle && !ring && !pinky) return 'POINTING'
  if (!index && !middle && !ring && !pinky && !thumbExtended) return 'FIST'
  return 'UNKNOWN'
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

  const settle = <T extends string>(
    value: T,
    key: 'expression' | 'eyes' | 'mouth' | 'head',
    countKey: 'expressionCount' | 'eyesCount' | 'mouthCount' | 'headCount',
    previousValue: T,
  ) => {
    if (value === pending[key]) pending[countKey] += 1
    else {
      pending[key] = value as never
      pending[countKey] = 1
    }

    // Accept a new state after two consecutive 100ms samples (~200ms).
    // This removes one-frame landmark jitter without reintroducing a long lock.
    return pending[countKey] >= 2 ? value : previousValue
  }

  return {
    facePresent: true,
    faceExpression: settle(raw.faceExpression, 'expression', 'expressionCount', base.faceExpression),
    eyes: settle(raw.eyes, 'eyes', 'eyesCount', base.eyes),
    mouth: settle(raw.mouth, 'mouth', 'mouthCount', base.mouth),
    headDirection: settle(raw.headDirection, 'head', 'headCount', base.headDirection),
  }
}

export function useExpressionGestureDetection(
  faceLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handedness: React.MutableRefObject<string[]>,
  enabled: boolean,
) {
  const [state, setState] = useState<VisionAnalysisState>({
    ...noFaceState(),
    handGestures: [],
  })

  const previousFaceRef = useRef<FaceAnalysis | null>(null)
  const pendingFaceRef = useRef<PendingFace>({
    expression: 'NO FACE',
    expressionCount: 0,
    eyes: 'NO FACE',
    eyesCount: 0,
    mouth: 'NO FACE',
    mouthCount: 0,
    head: 'NO FACE',
    headCount: 0,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ ...noFaceState(), handGestures: [] })
      previousFaceRef.current = null
      pendingFaceRef.current = {
        expression: 'NO FACE',
        expressionCount: 0,
        eyes: 'NO FACE',
        eyesCount: 0,
        mouth: 'NO FACE',
        mouthCount: 0,
        head: 'NO FACE',
        headCount: 0,
      }
      return
    }

    const update = () => {
      const rawFaceState = analyzeFace(faceLandmarks.current[0])
      const faceState = smoothFaceState(rawFaceState, previousFaceRef.current, pendingFaceRef.current)
      previousFaceRef.current = faceState

      const handGestures = handLandmarks.current.map((hand, index) => ({
        handedness: handedness.current[index] === 'Left' || handedness.current[index] === 'Right'
          ? handedness.current[index] as 'Left' | 'Right'
          : 'Hand',
        gesture: analyzeHand(hand),
      }))

      setState({ ...faceState, handGestures })
    }

    update()
    const interval = window.setInterval(update, 100)
    return () => window.clearInterval(interval)
  }, [enabled, faceLandmarks, handLandmarks, handedness])

  return state
}
