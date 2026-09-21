'use client'

import { useEffect, useRef, useState } from 'react'
import { getAllMemes } from '@/lib/memes'
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

const CONDITION_WEIGHTS: Record<MemeCondition['feature'], number> = {
  eyes: 1,
  mouth: 1,
  expression: 1.15,
  gaze: 0.9,
  hands: 1.25,
  finger: 1.25,
  movement: 0.5,
}

const TRIGGER_THRESHOLD = 55

function matchMeme(meme: Meme, analysis: VisionAnalysisState, face: NormalizedLandmark[] | undefined, hands: NormalizedLandmark[][]): MemeMatch {
  const conditions = meme.trigger.conditions.filter(condition => condition.enabled !== false)
  const required = conditions.filter(condition => condition.required)

  if (!analysis.facePresent || !conditions.length) {
    return { meme, score: 0, matched: 0, total: conditions.length }
  }

  const weightedTotal = conditions.reduce(
    (sum, condition) => sum + (CONDITION_WEIGHTS[condition.feature] ?? 1),
    0,
  )
  const weightedMatched = conditions.reduce((sum, condition) => {
    if (!conditionMatches(condition, analysis, face, hands)) return sum
    return sum + (CONDITION_WEIGHTS[condition.feature] ?? 1)
  }, 0)

  const matched = conditions.filter(condition => conditionMatches(condition, analysis, face, hands)).length
  const score = weightedTotal
    ? Math.round((weightedMatched / weightedTotal) * 100)
    : 0

  // "Required" conditions now act as a soft preference rather than a hard
  // gate. A strong primary signal can trigger the meme even when a supporting
  // condition is imperfect, which is much closer to how a human reacts.
  const hasPrimarySignal = conditions.some(condition => {
    const weight = CONDITION_WEIGHTS[condition.feature] ?? 1
    return conditionMatches(condition, analysis, face, hands) && weight >= 1
  })

  // Keep an optional condition useful without making it a blocker.
  const requiredMisses = required.filter(
    condition => !conditionMatches(condition, analysis, face, hands),
  ).length

  const relaxedThreshold = requiredMisses > 0 ? TRIGGER_THRESHOLD : 45
  const triggered = hasPrimarySignal && score >= relaxedThreshold

  return {
    meme,
    score: triggered ? score : 0,
    matched,
    total: conditions.length,
  }
}

export function useMemeTriggerEngine(
  analysis: VisionAnalysisState,
  faceLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  enabled: boolean,
) {
  const [matches, setMatches] = useState<MemeMatch[]>([])
  const candidateIdRef = useRef<string | null>(null)
  const candidateCountRef = useRef(0)
  const stableIdRef = useRef<string | null>(null)
  const stableUntilRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setMatches([])
      candidateIdRef.current = null
      candidateCountRef.current = 0
      stableIdRef.current = null
      stableUntilRef.current = 0
      return
    }

    const update = () => {
      const face = faceLandmarks.current[0]
      const hands = handLandmarks.current
      const freshMatches = memes
        .filter(meme => meme.enabled)
        .map(meme => matchMeme(meme, analysis, face, hands))
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score)

      const candidate = freshMatches[0] ?? null
      const now = performance.now()

      if (!candidate) {
        // Keep a just-triggered meme visible briefly instead of dropping it
        // on a single imperfect camera frame.
        if (stableIdRef.current && now < stableUntilRef.current) return
        stableIdRef.current = null
        setMatches([])
        candidateIdRef.current = null
        candidateCountRef.current = 0
        return
      }

      // Require the same winner for a few consecutive samples. This removes
      // one-frame false positives without making the user hold a pose for long.
      if (candidateIdRef.current === candidate.meme.id) {
        candidateCountRef.current += 1
      } else {
        candidateIdRef.current = candidate.meme.id
        candidateCountRef.current = 1
      }

      const isSameStable = stableIdRef.current === candidate.meme.id
      const isStrongEnough = candidate.score >= 70
      const confirmationNeeded = isStrongEnough ? 2 : 3

      if (!isSameStable && candidateCountRef.current < confirmationNeeded) {
        return
      }

      if (!isSameStable) {
        stableIdRef.current = candidate.meme.id
      }

      // Hold the selected reaction for a short cooldown so tiny landmark
      // changes don't make the UI flicker between memes.
      stableUntilRef.current = now + 900

      // Once stable, allow the other matches to update normally so the panel
      // remains useful while the winner is held.
      setMatches(freshMatches)
    }

    update()
    const interval = window.setInterval(update, 120)
    return () => window.clearInterval(interval)
  }, [analysis, enabled, faceLandmarks, handLandmarks])

  return { matches, topMatch: matches[0] ?? null }
}
