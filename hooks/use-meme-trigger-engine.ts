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
    if (value === 'happy') return analysis.faceExpression === 'HAPPY'
    if (value === 'sad') return analysis.faceExpression === 'SAD'
    if (value === 'angry') return analysis.faceExpression === 'ANGRY'
    if (value === 'smirk') return analysis.faceExpression === 'SMIRK'
    return false
  }

  if (condition.feature === 'expression') {
    if (value === 'excited') return analysis.faceExpression === 'SURPRISED' || analysis.faceExpression === 'HAPPY'
    if (value === 'smiling') return analysis.faceExpression === 'HAPPY' || analysis.mouth === 'SMILE'
    if (value === 'crying') return analysis.faceExpression === 'SAD' || analysis.mouth === 'FROWN'
    if (value === 'happy') return analysis.faceExpression === 'HAPPY'
    if (value === 'sad') return analysis.faceExpression === 'SAD'
    if (value === 'angry') return analysis.faceExpression === 'ANGRY'
    if (value === 'smirk') return analysis.faceExpression === 'SMIRK'
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
    const gestureMap: Record<string, string> = {
      fist: 'FIST',
      'open-palm': 'OPEN PALM',
      'thumbs-up': 'THUMBS UP',
      'thumbs-down': 'THUMBS DOWN',
      pointing: 'POINTING',
      peace: 'PEACE',
      'three-fingers': 'THREE FINGERS',
      'four-fingers': 'FOUR FINGERS',
      ok: 'OK',
      rock: 'ROCK',
      pinch: 'PINCH',
      'finger-gun': 'FINGER GUN',
      'unknown-gesture': 'UNKNOWN',
    }
    if (gestureMap[value]) return analysis.handGestures.some(hand => hand.gesture === gestureMap[value])
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
const FAST_TRIGGER_SCORE = 82
const NORMAL_TRIGGER_SCORE = 65
const LOCK_MS = 1100
const TAKEOVER_MARGIN = 12
const TAKEOVER_SCORE = 78

function matchMeme(
  meme: Meme,
  analysis: VisionAnalysisState,
  face: NormalizedLandmark[] | undefined,
  hands: NormalizedLandmark[][],
): MemeMatch {
  const conditions = meme.trigger.conditions.filter(condition => condition.enabled !== false)

  if (!analysis.facePresent || !conditions.length) {
    return { meme, score: 0, matched: 0, total: conditions.length }
  }

  // Conditions using the same feature are alternatives (OR).
  // Different features are combined (soft AND).
  // Example: Happy + Sad + Open Mouth means:
  // (Happy OR Sad) AND Open Mouth.
  const groups = Array.from(new Map(
    conditions.map(condition => [condition.feature, [] as MemeCondition[]]),
  ).values())

  conditions.forEach(condition => {
    const group = groups.find(item => item[0]?.feature === condition.feature)
    if (group && !group.some(item => item.value === condition.value)) group.push(condition)
  })

  const groupResults = groups.map(group => {
    const matched = group.filter(condition => conditionMatches(condition, analysis, face, hands))
    const weight = Math.max(...group.map(condition => CONDITION_WEIGHTS[condition.feature] ?? 1))
    const groupScore = matched.length > 0 ? 1 : 0
    return { group, matched, weight, groupScore }
  })

  const totalWeight = groupResults.reduce((sum, group) => sum + group.weight, 0)
  const matchedWeight = groupResults.reduce((sum, group) => sum + group.weight * group.groupScore, 0)
  const score = totalWeight ? Math.round((matchedWeight / totalWeight) * 100) : 0
  const matched = groupResults.reduce((sum, group) => sum + group.matched.length, 0)

  const hasPrimarySignal = groupResults.some(group =>
    group.matched.length > 0 && group.weight >= 1,
  )

  const requiredMisses = conditions.filter(
    condition => condition.required && !conditionMatches(condition, analysis, face, hands),
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
  const stableScoreRef = useRef(0)
  const stableUntilRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setMatches([])
      candidateIdRef.current = null
      candidateCountRef.current = 0
      stableIdRef.current = null
      stableScoreRef.current = 0
      stableUntilRef.current = 0
      return
    }

    const update = () => {
      const face = faceLandmarks.current[0]
      const hands = handLandmarks.current
      const freshMatches = getAllMemes()
        .filter(meme => meme.enabled)
        .map(meme => matchMeme(meme, analysis, face, hands))
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score)

      const candidate = freshMatches[0] ?? null
      const now = performance.now()

      // Keep the current winner locked unless a clearly stronger reaction appears.
      if (stableIdRef.current) {
        const stableMatch = freshMatches.find(match => match.meme.id === stableIdRef.current)

        if (now < stableUntilRef.current) {
          if (!candidate || candidate.meme.id !== stableIdRef.current) {
            if (!candidate || candidate.score < stableScoreRef.current + TAKEOVER_MARGIN || candidate.score < TAKEOVER_SCORE) {
              if (stableMatch) setMatches([stableMatch, ...freshMatches.filter(match => match.meme.id !== stableIdRef.current)])
              return
            }
          }
        }

        if (!candidate) {
          if (now < stableUntilRef.current && stableMatch) {
            setMatches([stableMatch])
            return
          }
          stableIdRef.current = null
          stableScoreRef.current = 0
        } else if (candidate.meme.id !== stableIdRef.current) {
          const clearlyStronger = candidate.score >= Math.max(TAKEOVER_SCORE, stableScoreRef.current + TAKEOVER_MARGIN)
          if (!clearlyStronger && now < stableUntilRef.current) {
            if (stableMatch) setMatches([stableMatch, ...freshMatches.filter(match => match.meme.id !== stableIdRef.current)])
            return
          }
          stableIdRef.current = null
          stableScoreRef.current = 0
          candidateIdRef.current = null
          candidateCountRef.current = 0
        }
      }

      if (!candidate) {
        if (stableIdRef.current && now < stableUntilRef.current) return
        setMatches([])
        candidateIdRef.current = null
        candidateCountRef.current = 0
        return
      }

      if (candidateIdRef.current === candidate.meme.id) {
        candidateCountRef.current += 1
      } else {
        candidateIdRef.current = candidate.meme.id
        candidateCountRef.current = 1
      }

      const confirmationNeeded =
        candidate.score >= FAST_TRIGGER_SCORE ? 1 :
        candidate.score >= NORMAL_TRIGGER_SCORE ? 2 : 3

      if (candidateIdRef.current !== stableIdRef.current && candidateCountRef.current < confirmationNeeded) {
        return
      }

      stableIdRef.current = candidate.meme.id
      stableScoreRef.current = candidate.score
      stableUntilRef.current = now + LOCK_MS
      setMatches(freshMatches)
    }

    update()
    const interval = window.setInterval(update, 100)
    return () => window.clearInterval(interval)
  }, [analysis, enabled, faceLandmarks, handLandmarks])

  return { matches, topMatch: matches[0] ?? null }
}
