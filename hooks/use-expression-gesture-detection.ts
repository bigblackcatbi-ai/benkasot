'use client'

import { useEffect, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FaceExpression = 'NEUTRAL' | 'SURPRISED' | 'HAPPY' | 'SAD' | 'ANGRY' | 'SMIRK'
export type EyeState = 'OPEN' | 'CLOSED' | 'WINK LEFT' | 'WINK RIGHT'
export type MouthState = 'OPEN' | 'CLOSED' | 'SMILE' | 'FROWN'
export type HeadDirection = 'FORWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
export type HandGesture = 'OPEN PALM' | 'FIST' | 'THUMBS UP' | 'THUMBS DOWN' | 'POINTING' | 'PEACE' | 'THREE FINGERS' | 'FOUR FINGERS' | 'OK' | 'ROCK' | 'PINCH' | 'FINGER GUN' | 'UNKNOWN'

export interface HandGestureState {
  handedness: 'Left' | 'Right' | 'Hand'
  gesture: HandGesture
}

export interface VisionAnalysisState {
  faceExpression: FaceExpression
  eyes: EyeState
  mouth: MouthState
  headDirection: HeadDirection
  handGestures: HandGestureState[]
}

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))

const angle = (a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) => {
  const abx = a.x - b.x, aby = a.y - b.y
  const cbx = c.x - b.x, cby = c.y - b.y
  const dot = abx * cbx + aby * cby
  const mag = Math.hypot(abx, aby) * Math.hypot(cbx, cby)
  return mag > 0 ? Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180 / Math.PI : 0
}

function analyzeFace(face: NormalizedLandmark[] | undefined) {
  if (!face || face.length < 400) return {
    faceExpression: 'NEUTRAL' as FaceExpression,
    eyes: 'OPEN' as EyeState,
    mouth: 'CLOSED' as MouthState,
    headDirection: 'FORWARD' as HeadDirection,
  }

  const leftEyeWidth = distance(face[33], face[133])
  const rightEyeWidth = distance(face[362], face[263])
  const leftEyeOpen = distance(face[159], face[145]) / Math.max(leftEyeWidth, 0.001)
  const rightEyeOpen = distance(face[386], face[374]) / Math.max(rightEyeWidth, 0.001)
  const leftClosed = leftEyeOpen < 0.14
  const rightClosed = rightEyeOpen < 0.14
  const eyes: EyeState = leftClosed && !rightClosed ? 'WINK LEFT' : rightClosed && !leftClosed ? 'WINK RIGHT' : leftClosed && rightClosed ? 'CLOSED' : 'OPEN'

  const mouthWidth = distance(face[61], face[291])
  const mouthOpenRatio = distance(face[13], face[14]) / Math.max(mouthWidth, 0.001)
  const mouthCornerY = (face[61].y + face[291].y) / 2
  const lipCenterY = (face[13].y + face[14].y) / 2
  const smile = mouthCornerY < lipCenterY - mouthWidth * 0.05
  const frown = mouthCornerY > lipCenterY + mouthWidth * 0.05
  const mouth: MouthState = mouthOpenRatio > 0.23 ? 'OPEN' : smile ? 'SMILE' : frown ? 'FROWN' : 'CLOSED'

  const eyeCenterX = (face[33].x + face[263].x) / 2
  const eyeCenterY = (face[33].y + face[263].y) / 2
  const nose = face[1]
  const horizontalOffset = nose.x - eyeCenterX
  const verticalOffset = nose.y - eyeCenterY
  let headDirection: HeadDirection = 'FORWARD'
  if (horizontalOffset < -0.055) headDirection = 'LEFT'
  else if (horizontalOffset > 0.055) headDirection = 'RIGHT'
  else if (verticalOffset < -0.11) headDirection = 'UP'
  else if (verticalOffset > 0.11) headDirection = 'DOWN'

  const browLeft = face[105].y - face[159].y
  const browRight = face[334].y - face[386].y
  const angry = browLeft < -0.045 && browRight < -0.045
  const happy = mouth === 'SMILE'
  const sad = mouth === 'FROWN'
  const surprised = eyes === 'OPEN' && mouth === 'OPEN'
  const asymmetry = Math.abs((face[61].y - face[291].y) / Math.max(mouthWidth, 0.001))
  const faceExpression: FaceExpression = surprised ? 'SURPRISED' : angry ? 'ANGRY' : happy ? 'HAPPY' : sad ? 'SAD' : asymmetry > 0.12 ? 'SMIRK' : 'NEUTRAL'

  return { faceExpression, eyes, mouth, headDirection }
}

const fingerAngle = (hand: NormalizedLandmark[], mcp: number, pip: number, tip: number) =>
  angle(hand[mcp], hand[pip], hand[tip])

const isExtended = (hand: NormalizedLandmark[], mcp: number, pip: number, tip: number) =>
  fingerAngle(hand, mcp, pip, tip) > 155 && distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.02

function analyzeHand(hand: NormalizedLandmark[]): HandGesture {
  if (hand.length < 21) return 'UNKNOWN'

  const index = isExtended(hand, 5, 6, 8)
  const middle = isExtended(hand, 9, 10, 12)
  const ring = isExtended(hand, 13, 14, 16)
  const pinky = isExtended(hand, 17, 18, 20)

  const thumbTip = hand[4]
  const thumbBase = hand[2]
  const thumbExtended = distance(thumbTip, hand[0]) > distance(hand[3], hand[0]) * 1.02
  const thumbUp = thumbTip.y < hand[2].y - 0.06
  const thumbDown = thumbTip.y > hand[2].y + 0.08
  const palmSize = Math.max(distance(hand[0], hand[9]), 0.001)
  const thumbIndexGap = distance(hand[4], hand[8]) / palmSize

  const extendedCount = [index, middle, ring, pinky].filter(Boolean).length
  const foldedCount = 4 - extendedCount

  if (thumbIndexGap < 0.42 && middle && ring && pinky) return 'OK'
  if (thumbIndexGap < 0.34 && !middle && !ring && !pinky) return 'PINCH'
  if (thumbUp && thumbExtended && foldedCount === 4) return 'THUMBS UP'
  if (thumbDown && thumbExtended && foldedCount === 4) return 'THUMBS DOWN'
  if (index && !middle && !ring && pinky && thumbExtended) return 'FINGER GUN'
  if (index && !middle && !ring && !pinky) return 'POINTING'
  if (index && middle && !ring && !pinky) return 'PEACE'
  if (index && middle && ring && !pinky) return 'THREE FINGERS'
  if (index && middle && ring && pinky) return 'OPEN PALM'
  if (!index && !middle && !ring && !pinky && !thumbExtended) return 'FIST'
  if (!index && !middle && !ring && pinky) return 'ROCK'
  if (extendedCount === 4) return 'FOUR FINGERS'
  return 'UNKNOWN'
}

export function useExpressionGestureDetection(
  faceLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handedness: React.MutableRefObject<string[]>,
  enabled: boolean,
) {
  const [state, setState] = useState<VisionAnalysisState>({
    faceExpression: 'NEUTRAL',
    eyes: 'OPEN',
    mouth: 'CLOSED',
    headDirection: 'FORWARD',
    handGestures: [],
  })

  useEffect(() => {
    if (!enabled) {
      setState({ faceExpression: 'NEUTRAL', eyes: 'OPEN', mouth: 'CLOSED', headDirection: 'FORWARD', handGestures: [] })
      return
    }

    const update = () => {
      const faceState = analyzeFace(faceLandmarks.current[0])
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
