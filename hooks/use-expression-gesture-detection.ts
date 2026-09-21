'use client'

import { useEffect, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FaceExpression = 'NEUTRAL' | 'SURPRISED'
export type EyeState = 'OPEN' | 'CLOSED'
export type MouthState = 'OPEN' | 'CLOSED'
export type HeadDirection = 'FORWARD' | 'LEFT' | 'RIGHT' | 'UP' | 'DOWN'
export type HandGesture = 'OPEN PALM' | 'FIST' | 'THUMBS UP' | 'POINTING' | 'PEACE' | 'OK' | 'UNKNOWN'

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

const ratio = (a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) => {
  const denominator = distance(b, c)
  return denominator > 0 ? distance(a, b) / denominator : 0
}

function analyzeFace(face: NormalizedLandmark[] | undefined) {
  if (!face || face.length < 400) {
    return { faceExpression: 'NEUTRAL' as FaceExpression, eyes: 'OPEN' as EyeState, mouth: 'CLOSED' as MouthState, headDirection: 'FORWARD' as HeadDirection }
  }

  const leftEyeWidth = distance(face[33], face[133])
  const rightEyeWidth = distance(face[362], face[263])
  const leftEyeOpen = distance(face[159], face[145]) / Math.max(leftEyeWidth, 0.001)
  const rightEyeOpen = distance(face[386], face[374]) / Math.max(rightEyeWidth, 0.001)
  const eyes: EyeState = (leftEyeOpen + rightEyeOpen) / 2 > 0.18 ? 'OPEN' : 'CLOSED'

  const mouthWidth = distance(face[61], face[291])
  const mouthOpenRatio = distance(face[13], face[14]) / Math.max(mouthWidth, 0.001)
  const mouth: MouthState = mouthOpenRatio > 0.23 ? 'OPEN' : 'CLOSED'

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

  const faceExpression: FaceExpression = eyes === 'OPEN' && mouth === 'OPEN' ? 'SURPRISED' : 'NEUTRAL'
  return { faceExpression, eyes, mouth, headDirection }
}

const fingerExtended = (hand: NormalizedLandmark[], tip: number, pip: number) =>
  distance(hand[tip], hand[0]) > distance(hand[pip], hand[0]) * 1.12

const fingerFolded = (hand: NormalizedLandmark[], tip: number, pip: number) =>
  distance(hand[tip], hand[0]) < distance(hand[pip], hand[0]) * 1.08

function analyzeHand(hand: NormalizedLandmark[]): HandGesture {
  if (hand.length < 21) return 'UNKNOWN'

  const index = fingerExtended(hand, 8, 6)
  const middle = fingerExtended(hand, 12, 10)
  const ring = fingerExtended(hand, 16, 14)
  const pinky = fingerExtended(hand, 20, 18)
  const indexFolded = fingerFolded(hand, 8, 6)
  const middleFolded = fingerFolded(hand, 12, 10)
  const ringFolded = fingerFolded(hand, 16, 14)
  const pinkyFolded = fingerFolded(hand, 20, 18)
  const thumbExtended = distance(hand[4], hand[0]) > distance(hand[3], hand[0]) * 1.08

  const palmSize = Math.max(distance(hand[0], hand[9]), 0.001)
  const thumbIndexGap = distance(hand[4], hand[8]) / palmSize

  if (thumbIndexGap < 0.38 && middle && ring && pinky) return 'OK'

  const upThumb = hand[4].y < hand[3].y && hand[3].y < hand[2].y && indexFolded && middleFolded && ringFolded && pinkyFolded
  if (upThumb) return 'THUMBS UP'

  if (index && middle && ring && pinky && thumbExtended) return 'OPEN PALM'
  if (index && middle && !ring && !pinky) return 'PEACE'
  if (index && !middle && !ring && !pinky) return 'POINTING'
  if (!index && !middle && !ring && !pinky && !thumbExtended) return 'FIST'

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
    const interval = window.setInterval(update, 120)
    return () => window.clearInterval(interval)
  }, [enabled, faceLandmarks, handLandmarks, handedness])

  return state
}
