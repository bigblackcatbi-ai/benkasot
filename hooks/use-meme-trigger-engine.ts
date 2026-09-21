'use client'

import { useEffect, useState } from 'react'
import { memes } from '@/lib/memes'
import type { Meme, MemeCondition } from '@/types/meme'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { VisionAnalysisState } from './use-expression-gesture-detection'

export interface MemeMatch {
  meme: Meme
  score: number
  matched: number
  total: number
}

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))

function conditionMatches(
  condition: MemeCondition,
  analysis: VisionAnalysisState,
  face: NormalizedLandmark[] | undefined,
  hands: NormalizedLandmark[][],
) {
  const value = condition.value

  if (condition.feature === 'eyes') {
    if (value === 'squinting') return analysis.eyes === 'CLOSED' || analysis.eyes.startsWith('WINK')
    if (value === 'wide') return analysis.faceExpression === 'SURPRISED' || (analysis.eyes === 'OPEN' && analysis.mouth === 'OPEN')
    if (value === 'closed') return analysis.eyes === 'CLOSED'
    return false
  }

  if (condition.feature === 'mouth') {
    if (value === 'open') return analysis.mouth === 'OPEN'
    if (value === 'closed' || value === 'neutral') return analysis.mouth === 'CLOSED'
    if (value === 'smiling') return analysis.mouth === 'SMILE' || analysis.faceExpression === 'HAPPY'
    if (value === 'crying') return analysis.faceExpression === 'SAD' || analysis.mouth === 'FROWN'
    return false
  }

  if (condition.feature === 'expression') {
    if (value === 'excited') return analysis.faceExpression === 'SURPRISED' || analysis.faceExpression === 'HAPPY'
    if (value === 'smiling') return analysis.faceExpression === 'HAPPY' || analysis.mouth === 'SMILE'
    if (value === 'crying') return analysis.faceExpression === 'SAD' || analysis.mouth === 'FROWN'
    return false
  }

  if (condition.feature === 'gaze') {
    if (value === 'upward') return analysis.headDirection === 'UP'
    if (value === 'right') return analysis.headDirection === 'RIGHT'
    return false
  }

  if (condition.feature === 'hands') {
    if (!hands.length) return false
    const faceCenter = face?.[1]
    if (!faceCenter) return false
    const nearHead = hands.filter(hand => {
      const wrist = hand[0]
      return wrist && Math.hypot(wrist.x - faceCenter.x, wrist.y - faceCenter.y) < 0.42
    }).length
    if (value === 'hands-on-head' || value === 'both-hands-near-head') return hands.length >= 2 && nearHead >= 2
    if (value === 'hand-on-head') return nearHead >= 1
    if (value === 'both-hands-near-left-chest') {
      const leftOfFace = hands.filter(hand => hand[0] && hand[0].x < faceCenter.x - 0.08).length
      return hands.length >= 2 && leftOfFace >= 2
    }
    if (value === 'fist') return analysis.handGestures.some(hand => hand.gesture === 'FIST')
    return false
  }

  if (condition.feature === 'finger') {
    const faceCenter = face?.[1]
    if (!faceCenter) return false
    if (value === 'index-finger-near-mouth') return hands.some(hand => hand[8] && face?.[13] && distance(hand[8], face[13]) < 0.16)
    if (value === 'index-finger-near-head') return hands.some(hand => hand[8] && Math.hypot(hand[8].x - faceCenter.x, hand[8].y - faceCenter.y) < 0.22)
    if (value === 'index-finger-to-chest') return hands.some(hand => hand[8] && hand[0] && hand[8].y > faceCenter.y + 0.18)
    return false
  }

  if (condition.feature === 'movement') return false
  return false
}

function matchMeme(meme: Meme, analysis: VisionAnalysisState, face: NormalizedLandmark[] | undefined, hands: NormalizedLandmark[][]): MemeMatch {
  const conditions = meme.trigger.conditions.filter(condition => condition.enabled !== false)
  const matched = conditions.filter(condition => conditionMatches(condition, analysis, face, hands)).length
  const total = conditions.length
  const required = conditions.filter(condition => condition.required)
  const requiredMatched = required.every(condition => conditionMatches(condition, analysis, face, hands))
  const score = total ? Math.round((matched / total) * 100) : 0
  return { meme, score: requiredMatched ? score : 0, matched, total }
}

export function useMemeTriggerEngine(
  analysis: VisionAnalysisState,
  faceLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  enabled: boolean,
) {
  const [matches, setMatches] = useState<MemeMatch[]>([])
  useEffect(() => {
    if (!enabled) {
      setMatches([])
      return
    }
    const update = () => {
      const face = faceLandmarks.current[0]
      const hands = handLandmarks.current
      setMatches(memes.filter(meme => meme.enabled).map(meme => matchMeme(meme, analysis, face, hands)).filter(match => match.score > 0).sort((a,b) => b.score - a.score))
    }
    update()
    const interval = window.setInterval(update, 150)
    return () => window.clearInterval(interval)
  }, [analysis, enabled, faceLandmarks, handLandmarks])
  return { matches, topMatch: matches[0] ?? null }
}
