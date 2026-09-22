'use client'

import { useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FaceExpression = 'NO FACE' | 'NEUTRAL' | 'SURPRISED' | 'HAPPY' | 'SAD' | 'SMIRK'
export type EyeState = 'NO FACE' | 'OPEN' | 'WIDE' | 'SQUINTING' | 'CLOSED' | 'WINK LEFT' | 'WINK RIGHT'
export type MouthState = 'NO FACE' | 'OPEN' | 'CLOSED' | 'SMILE' | 'FROWN'
export type HeadDirection = 'NO FACE' | 'FORWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
export type HandGesture = 'OPEN PALM' | 'FIST' | 'THUMBS UP' | 'THUMBS DOWN' | 'POINTING' | 'POINTING UP' | 'PEACE' | 'THREE FINGERS' | 'FOUR FINGERS' | 'OK' | 'ROCK' | 'PINCH' | 'FINGER GUN' | 'UNKNOWN'

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

// ---------------------------------------------------------------------------
// Detection tuning — single source of truth for the eye + fist thresholds.
// ---------------------------------------------------------------------------
// Eye-opening is measured as a normalized ratio: lid height (upper lid 159/386
// to lower lid 145/374) divided by eye width (outer corner 33/263 to inner
// corner 133/362). Because both parts of the ratio scale together, it is
// independent of webcam distance. The three cut points below create four bands:
//
//   ratio < closedThreshold            -> CLOSED
//   closedThreshold <= r < squint       -> SQUINTING
//   squintThreshold  <= r < wide        -> OPEN
//   ratio >= wideThreshold              -> WIDE
//
// These are the ONLY place the eye bands are defined. If your eyes/webcam read
// differently, adjust here rather than anywhere else.
export const EYE_CONFIG = {
  closedThreshold: 0.14,
  squintThreshold: 0.26,
  wideThreshold: 0.40,
  // Rolling-average window (in samples) used to stop the eye state flickering.
  smoothingSamples: 5,
}

// A finger is treated as folded into the palm when its tip→MCP distance drops
// below this fraction of its total bone length. Ratio-based, so it is
// independent of camera distance. Lower = tighter fist required.
const FIST_CURL_RATIO = 0.62

// POINTING UP tuning. The index finger must be oriented steeply upward and its
// tip must sit clearly above the wrist, both normalized against palm size so it
// works for either hand at any distance.
const POINT_UP_CONFIG = {
  // Tip must be at least this many palm-heights above the wrist.
  minRise: 0.7,
  // Vertical rise of the finger (MCP->TIP) must exceed its horizontal run by
  // this factor, so the finger genuinely points up rather than sideways.
  verticalDominance: 1.1,
}

type SingleEyeState = 'OPEN' | 'WIDE' | 'SQUINTING' | 'CLOSED'

export interface EyeHistory {
  left: number[]
  right: number[]
}

// Push a raw sample into the rolling buffer and return its smoothed average.
function pushSample(buffer: number[], value: number): number {
  buffer.push(value)
  while (buffer.length > EYE_CONFIG.smoothingSamples) buffer.shift()
  let sum = 0
  for (const sample of buffer) sum += sample
  return sum / buffer.length
}

function classifyEye(smoothedRatio: number): SingleEyeState {
  if (smoothedRatio < EYE_CONFIG.closedThreshold) return 'CLOSED'
  if (smoothedRatio < EYE_CONFIG.squintThreshold) return 'SQUINTING'
  if (smoothedRatio >= EYE_CONFIG.wideThreshold) return 'WIDE'
  return 'OPEN'
}

// Combine both eyes, preserving the existing WINK / CLOSED semantics and adding
// distinct SQUINTING and WIDE states. WIDE requires BOTH eyes so a single noisy
// landmark cannot trigger it.
function combineEyeStates(left: SingleEyeState, right: SingleEyeState): EyeState {
  if (left === 'CLOSED' && right === 'CLOSED') return 'CLOSED'
  if (left === 'CLOSED') return 'WINK LEFT'
  if (right === 'CLOSED') return 'WINK RIGHT'
  if (left === 'WIDE' && right === 'WIDE') return 'WIDE'
  if (left === 'SQUINTING' || right === 'SQUINTING') return 'SQUINTING'
  return 'OPEN'
}

function noFaceState() {
  return {
    facePresent: false,
    faceExpression: 'NO FACE' as FaceExpression,
    eyes: 'NO FACE' as EyeState,
    mouth: 'NO FACE' as MouthState,
    headDirection: 'NO FACE' as HeadDirection,
  }
}

function analyzeFace(face: NormalizedLandmark[] | undefined, eyeHistory: EyeHistory) {
  if (!face || face.length < 400) {
    eyeHistory.left.length = 0
    eyeHistory.right.length = 0
    return noFaceState()
  }

  const leftEyeWidth = distance(face[33], face[133])
  const rightEyeWidth = distance(face[362], face[263])
  const leftEyeOpen = distance(face[159], face[145]) / Math.max(leftEyeWidth, 0.001)
  const rightEyeOpen = distance(face[386], face[374]) / Math.max(rightEyeWidth, 0.001)
  // Smooth each eye over a short rolling window, then classify into three
  // distinct states so a partial squint is not read as OPEN or CLOSED.
  const leftState = classifyEye(pushSample(eyeHistory.left, leftEyeOpen))
  const rightState = classifyEye(pushSample(eyeHistory.right, rightEyeOpen))
  const eyes: EyeState = combineEyeStates(leftState, rightState)

  const mouthWidth = distance(face[61], face[291])
  const mouthOpenRatio = distance(face[13], face[14]) / Math.max(mouthWidth, 0.001)
  const mouthCornerY = (face[61].y + face[291].y) / 2
  const lipCenterY = (face[13].y + face[14].y) / 2
  const smile = mouthCornerY < lipCenterY - mouthWidth * 0.05
  const frown = mouthCornerY > lipCenterY + mouthWidth * 0.05
  const mouth: MouthState = mouthOpenRatio > 0.23 ? 'OPEN' : smile ? 'SMILE' : frown ? 'FROWN' : 'CLOSED'

  const eyeCenterX = (face[33].x + face[263].x) / 2
  const eyeCenterY = (face[33].y + face[263].y) / 2
  const eyeDistance = Math.max(distance(face[33], face[263]), 0.001)
  const nose = face[1]

  // Normalize yaw/pitch against the face instead of using raw coordinates.
  // This prevents the natural nose position below the eyes from being mistaken for "DOWN".
  const faceX = face.slice(0, 468).map(point => point.x)
  const faceY = face.slice(0, 468).map(point => point.y)
  const minX = Math.min(...faceX)
  const maxX = Math.max(...faceX)
  const minY = Math.min(...faceY)
  const maxY = Math.max(...faceY)
  const yawPosition = (nose.x - minX) / Math.max(maxX - minX, 0.001)
  const pitchPosition = (nose.y - minY) / Math.max(maxY - minY, 0.001)

  let headDirection: HeadDirection = 'FORWARD'
  if (yawPosition < 0.43) headDirection = 'LEFT'
  else if (yawPosition > 0.57) headDirection = 'RIGHT'
  else if (pitchPosition < 0.40) headDirection = 'UP'
  else if (pitchPosition > 0.55) headDirection = 'DOWN'
  else {
    const yawOffset = (nose.x - eyeCenterX) / eyeDistance
    if (yawOffset < -0.12) headDirection = 'LEFT'
    else if (yawOffset > 0.12) headDirection = 'RIGHT'
  }

  const browLeft = face[105].y - face[159].y
  const browRight = face[334].y - face[386].y
  // lowered/furrowed brows alone do not produce a distinct expression — they fall through to NEUTRAL
  void browLeft; void browRight
  const happy = mouth === 'SMILE'
  const sad = mouth === 'FROWN'
  const surprised = (eyes === 'OPEN' || eyes === 'WIDE') && mouth === 'OPEN'
  const asymmetry = Math.abs((face[61].y - face[291].y) / Math.max(mouthWidth, 0.001))
  const faceExpression: FaceExpression = surprised ? 'SURPRISED' : happy ? 'HAPPY' : sad ? 'SAD' : asymmetry > 0.12 ? 'SMIRK' : 'NEUTRAL'

  return { facePresent: true, faceExpression, eyes, mouth, headDirection }
}

const angle = (a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) => {
  const abx = a.x - b.x, aby = a.y - b.y
  const cbx = c.x - b.x, cby = c.y - b.y
  const dot = abx * cbx + aby * cby
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby)
  return mag > 0 ? Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180 / Math.PI : 0
}

const fingerAngle = (hand: NormalizedLandmark[], mcp: number, pip: number, tip: number) =>
  angle(hand[mcp], hand[pip], hand[tip])

const isExtended = (hand: NormalizedLandmark[], mcp: number, pip: number, tip: number) =>
  fingerAngle(hand, mcp, pip, tip) > 155 && distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.02

// Tip→MCP distance as a fraction of the finger's total bone length. A straight
// finger is ~1.0; a finger folded into the palm is much lower. Normalized by
// bone length, so it does not depend on how close the hand is to the camera.
const curlRatio = (hand: NormalizedLandmark[], mcp: number, pip: number, dip: number, tip: number) => {
  const length = distance(hand[mcp], hand[pip]) + distance(hand[pip], hand[dip]) + distance(hand[dip], hand[tip])
  return length > 0 ? distance(hand[tip], hand[mcp]) / length : 1
}

const isCurled = (hand: NormalizedLandmark[], mcp: number, pip: number, dip: number, tip: number) =>
  curlRatio(hand, mcp, pip, dip, tip) < FIST_CURL_RATIO

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

  // Index-finger orientation used to separate POINTING UP from generic POINTING.
  // Uses the finger's own geometry normalized by palm size (not raw screen
  // position), so it works for either hand at any distance from the camera.
  const indexRise = (hand[0].y - hand[8].y) / palmSize
  const indexVertical = hand[5].y - hand[8].y
  const indexHorizontal = Math.abs(hand[8].x - hand[5].x)
  const pointingUp =
    indexRise > POINT_UP_CONFIG.minRise &&
    indexVertical > indexHorizontal * POINT_UP_CONFIG.verticalDominance

  // A true fist: every finger folded into the palm. Computed up front so a
  // clearly closed fist takes priority over the looser thumb/index PINCH check.
  const fist =
    isCurled(hand, 5, 6, 7, 8) &&
    isCurled(hand, 9, 10, 11, 12) &&
    isCurled(hand, 13, 14, 15, 16) &&
    isCurled(hand, 17, 18, 19, 20)

  if (thumbIndexGap < 0.42 && middle && ring && pinky) return 'OK'
  // PINCH still requires genuine thumb/index proximity, but never claims a hand
  // that is already a fully closed fist.
  if (thumbIndexGap < 0.34 && !middle && !ring && !pinky && !fist) return 'PINCH'
  if (thumbUp && thumbExtended && extendedCount === 0) return 'THUMBS UP'
  if (thumbDown && thumbExtended && extendedCount === 0) return 'THUMBS DOWN'
  if (index && !middle && !ring && pinky && thumbExtended) return 'FINGER GUN'
  if (!index && !middle && !ring && pinky) return 'ROCK'
  if (index && middle && ring && pinky) return thumbExtended ? 'OPEN PALM' : 'FOUR FINGERS'
  if (index && middle && ring && !pinky) return 'THREE FINGERS'
  if (index && middle && !ring && !pinky) return 'PEACE'
  if (index && !middle && !ring && !pinky) return pointingUp ? 'POINTING UP' : 'POINTING'
  if (fist) return 'FIST'
  return 'UNKNOWN'
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

  // Rolling buffers used to temporally smooth the eye-opening measurement.
  const eyeHistoryRef = useRef<EyeHistory>({ left: [], right: [] })

  useEffect(() => {
    if (!enabled) {
      eyeHistoryRef.current.left.length = 0
      eyeHistoryRef.current.right.length = 0
      setState({ ...noFaceState(), handGestures: [] })
      return
    }

    const update = () => {
      const faceState = analyzeFace(faceLandmarks.current[0], eyeHistoryRef.current)
      const handGestures: HandGestureState[] = handLandmarks.current.map((hand, index) => ({
        handedness: (handedness.current[index] === 'Left' || handedness.current[index] === 'Right'
          ? handedness.current[index]
          : 'Hand') as HandGestureState['handedness'],
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
