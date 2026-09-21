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

export interface MemeTriggerDebug {
  candidateId: string | null
  candidateScore: number
  candidateSamples: number
  confirmationNeeded: number
  stableId: string | null
  stableScore: number
  lockRemainingMs: number
}

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function indexExtensionConfidence(hand: NormalizedLandmark[]): number {
  const wrist = hand[0]
  const mcp = hand[5]
  const pip = hand[6]
  const dip = hand[7]
  const tip = hand[8]
  if (!wrist || !mcp || !pip || !dip || !tip) return 0

  const wristToTip = distance(wrist, tip)
  const wristToPip = distance(wrist, pip)
  const pipToTip = distance(pip, tip)
  const mcpToPip = distance(mcp, pip)
  if (wristToTip < wristToPip + 0.025) return 0

  const extension = clamp01((wristToTip - wristToPip) / 0.10)
  const straightness = clamp01(pipToTip / Math.max(mcpToPip, 0.001) / 1.15)
  return Math.sqrt(extension * straightness)
}

function strictProximity(distanceValue: number, limit: number): number {
  if (distanceValue >= limit) return 0
  return clamp01((limit - distanceValue) / (limit * 0.45))
}

function closestFacePoint(
  face: NormalizedLandmark[],
  indices: number[],
): NormalizedLandmark | undefined {
  return indices
    .map(index => face[index])
    .filter((point): point is NormalizedLandmark => Boolean(point))
    .reduce<NormalizedLandmark | undefined>((closest, point) => closest ?? point, undefined)
}

function conditionConfidence(
  condition: MemeCondition,
  analysis: VisionAnalysisState,
  face: NormalizedLandmark[] | undefined,
  hands: NormalizedLandmark[][],
): number {
  const value = condition.value

  if (condition.feature === 'eyes') {
    if (value === 'squinting') return analysis.eyes === 'CLOSED' || analysis.eyes.startsWith('WINK') ? analysis.visionConfidence.eyes : 0
    if (value === 'wide') return analysis.eyes === 'OPEN' && analysis.mouth === 'OPEN'
      ? Math.min(analysis.visionConfidence.eyes, analysis.visionConfidence.mouth)
      : analysis.faceExpression === 'SURPRISED' ? analysis.visionConfidence.expression : 0
    if (value === 'eyes-closed') return analysis.eyes === 'CLOSED' ? analysis.visionConfidence.eyes : 0
    if (value === 'wink-left') return analysis.eyes === 'WINK LEFT' ? analysis.visionConfidence.eyes : 0
    if (value === 'wink-right') return analysis.eyes === 'WINK RIGHT' ? analysis.visionConfidence.eyes : 0
    return 0
  }

  if (condition.feature === 'mouth') {
    if (value === 'open') return analysis.mouth === 'OPEN' ? analysis.visionConfidence.mouth : 0
    if (value === 'tongue-out') return analysis.mouth === 'TONGUE OUT' ? Math.max(analysis.signals.tongueOut, analysis.visionConfidence.mouth) : 0
    if (value === 'closed' || value === 'neutral') return analysis.mouth === 'CLOSED' ? analysis.visionConfidence.mouth : 0
    if (value === 'frown') return analysis.mouth === 'FROWN' ? analysis.visionConfidence.mouth : 0
    if (value === 'smiling') return analysis.mouth === 'SMILE' || analysis.faceExpression === 'HAPPY' ? Math.max(analysis.visionConfidence.mouth, analysis.visionConfidence.expression) : 0
    if (value === 'crying' || value === 'sad') return analysis.faceExpression === 'SAD' || analysis.mouth === 'FROWN' ? Math.max(analysis.visionConfidence.expression, analysis.visionConfidence.mouth) : 0
    if (value === 'happy') return analysis.faceExpression === 'HAPPY' ? analysis.visionConfidence.expression : 0
    if (value === 'angry') return analysis.faceExpression === 'ANGRY' ? analysis.visionConfidence.expression : 0
    if (value === 'smirk') return analysis.faceExpression === 'SMIRK' ? analysis.visionConfidence.expression : 0
    return 0
  }

  if (condition.feature === 'expression') {
    if (value === 'neutral') return analysis.faceExpression === 'NEUTRAL' ? analysis.visionConfidence.expression : 0
    if (value === 'excited') return analysis.faceExpression === 'SURPRISED' || analysis.faceExpression === 'HAPPY' ? analysis.visionConfidence.expression : 0
    if (value === 'smiling') return analysis.faceExpression === 'HAPPY' || analysis.mouth === 'SMILE' ? Math.max(analysis.visionConfidence.expression, analysis.visionConfidence.mouth) : 0
    if (value === 'crying' || value === 'sad') return analysis.faceExpression === 'SAD' ? analysis.visionConfidence.expression : 0
    if (value === 'happy') return analysis.faceExpression === 'HAPPY' ? analysis.visionConfidence.expression : 0
    if (value === 'angry') return analysis.faceExpression === 'ANGRY' ? analysis.visionConfidence.expression : 0
    if (value === 'smirk') return analysis.faceExpression === 'SMIRK' ? analysis.visionConfidence.expression : 0
    return 0
  }

  if (condition.feature === 'gaze') {
    const expected: Record<string, string> = { upward: 'UP', downward: 'DOWN', left: 'LEFT', right: 'RIGHT' }
    return expected[value] === analysis.headDirection ? analysis.visionConfidence.headDirection : 0
  }

  if (condition.feature === 'hands') {
    if (!hands.length) return 0
    const faceCenter = face?.[1]
    const forehead = face?.[10]
    if (!faceCenter || !forehead) return 0

    // "Hand on head" is intentionally strict: the palm must be near the
    // forehead/temple region and the wrist must be above the face center.
    // A hand merely passing in front of the face must not satisfy it.
    const headScores = hands.map(hand => {
      const wrist = hand[0]
      const palm = hand[9] ?? hand[5]
      if (!wrist || !palm) return 0
      if (wrist.y > faceCenter.y + 0.03) return 0

      const palmToForehead = Math.hypot(palm.x - forehead.x, palm.y - forehead.y)
      const verticalPosition = clamp01((faceCenter.y + 0.03 - wrist.y) / 0.18)
      return strictProximity(palmToForehead, 0.26) * verticalPosition
    })
    const nearHead = headScores.filter(score => score >= 0.45).length
    if (value === 'hands-on-head' || value === 'both-hands-near-head') {
      return hands.length >= 2 && nearHead >= 2 ? Math.min(...headScores.filter(score => score >= 0.45)) : 0
    }
    if (value === 'hand-on-head') return Math.max(...headScores, 0)
    if (value === 'both-hands-near-left-chest') {
      const scores = hands.map(hand => hand[0] && hand[0].x < faceCenter.x - 0.08 ? 0.75 : 0)
      return hands.length >= 2 && scores.filter(Boolean).length >= 2 ? Math.min(...scores.filter(Boolean)) : 0
    }
    if (value === 'two-hands') return hands.length >= 2 ? Math.min(...analysis.visionConfidence.hands.slice(0, 2)) : 0

    const gestureMap: Record<string, string> = {
      fist: 'FIST', 'open-palm': 'OPEN PALM', 'thumbs-up': 'THUMBS UP', 'thumbs-down': 'THUMBS DOWN',
      pointing: 'POINTING', peace: 'PEACE', 'three-fingers': 'THREE FINGERS', 'four-fingers': 'FOUR FINGERS',
      ok: 'OK', rock: 'ROCK', pinch: 'PINCH', 'finger-gun': 'FINGER GUN', 'unknown-gesture': 'UNKNOWN',
    }
    if (gestureMap[value]) {
      const scores = analysis.handGestures.map((hand, i) => hand.gesture === gestureMap[value] ? (analysis.visionConfidence.hands[i] ?? 0) : 0)
      return Math.max(...scores, 0)
    }

    const bothGestureMap: Record<string, string> = {
      'both-fists': 'FIST', 'both-open-palms': 'OPEN PALM', 'both-thumbs-up': 'THUMBS UP', 'both-peace': 'PEACE',
    }
    if (bothGestureMap[value]) {
      const scores = analysis.handGestures.map((hand, i) => hand.gesture === bothGestureMap[value] ? (analysis.visionConfidence.hands[i] ?? 0) : 0).filter(Boolean)
      return hands.length >= 2 && scores.length >= 2 ? Math.min(...scores) : 0
    }
    return 0
  }

  if (condition.feature === 'finger') {
    const faceCenter = face?.[1]
    if (!faceCenter) return 0
    const handConfidence = analysis.visionConfidence.hands

    if (value === 'index-finger-near-mouth') {
      const upperLip = face?.[13]
      const lowerLip = face?.[14]
      if (!upperLip || !lowerLip) return 0
      const lipCenter = {
        x: (upperLip.x + lowerLip.x) / 2,
        y: (upperLip.y + lowerLip.y) / 2,
        z: ((upperLip.z ?? 0) + (lowerLip.z ?? 0)) / 2,
      }
      const scores = hands.map((hand, i) => {
        const fingertip = hand[8]
        if (!fingertip) return 0
        const extension = indexExtensionConfidence(hand)
        const mouthDistance = distance(fingertip, lipCenter)
        // Very small target zone: nose/cheek/near-face positions do not count.
        return strictProximity(mouthDistance, 0.105) * extension * (handConfidence[i] ?? 0)
      })
      return Math.max(...scores, 0)
    }

    if (value === 'index-finger-near-head') {
      const headTarget = closestFacePoint(face ?? [], [10, 54, 284])
      if (!headTarget) return 0
      const scores = hands.map((hand, i) => {
        const fingertip = hand[8]
        if (!fingertip) return 0
        const extension = indexExtensionConfidence(hand)
        const headDistance = distance(fingertip, headTarget)
        return strictProximity(headDistance, 0.12) * extension * (handConfidence[i] ?? 0)
      })
      return Math.max(...scores, 0)
    }
    if (value === 'index-finger-to-chest') {
      const scores = hands.map((hand, i) => hand[8] && hand[0] && hand[8].y > faceCenter.y + 0.18 ? (handConfidence[i] ?? 0) : 0)
      return Math.max(...scores, 0)
    }
    return 0
  }

  return 0
}

function conditionMatches(
  condition: MemeCondition,
  analysis: VisionAnalysisState,
  face: NormalizedLandmark[] | undefined,
  hands: NormalizedLandmark[][],
) {
  return conditionConfidence(condition, analysis, face, hands) > 0.15
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

const TRIGGER_THRESHOLD = 82
const STRICT_CONFIDENCE_GATE = 0.68
const EXIT_SCORE = 52
const RELEASE_SCORE = 58
const RELEASE_SAMPLE_LIMIT = 2
const SWITCH_CONFIRM_SAMPLES = 3
const TAKEOVER_MARGIN = 12
const SWITCH_COOLDOWN_MS = 450
const MISS_LIMIT = 3

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
  const groups = [...new Set(conditions.map(condition => condition.feature))]
    .map(feature => conditions.filter(condition => condition.feature === feature))

  const groupResults = groups.map(group => {
    const scored = group.map(condition => ({ condition, confidence: conditionConfidence(condition, analysis, face, hands) }))
    const matched = scored.filter(item => item.confidence > 0.15).map(item => item.condition)
    const weight = Math.max(...group.map(condition => CONDITION_WEIGHTS[condition.feature] ?? 1))
    const groupScore = Math.max(...scored.map(item => item.confidence), 0)
    return { group, matched, weight, groupScore }
  })

  const totalWeight = groupResults.reduce((sum, group) => sum + group.weight, 0)
  const matchedWeight = groupResults.reduce((sum, group) => sum + group.weight * group.groupScore, 0)
  const weightedAverage = totalWeight ? matchedWeight / totalWeight : 0
  const weakestSignal = groupResults.length > 1 ? Math.min(...groupResults.map(group => group.groupScore)) : weightedAverage
  const combinedConfidence = groupResults.length > 1
    ? Math.sqrt(Math.max(0, weightedAverage) * Math.max(0, weakestSignal))
    : weightedAverage
  const score = Math.round(combinedConfidence * 100)
  const matched = groupResults.reduce((sum, group) => sum + group.matched.length, 0)

  const hasPrimarySignal = groupResults.some(group =>
    group.matched.length > 0 && group.weight >= 1,
  )

  // Multi-signal memes should not fire from a partial match. Same-feature
  // conditions remain OR, while different features are a real combination.
  // Example: (HAPPY OR SAD) + OPEN requires both the expression group and
  // mouth group. This removes most false positives caused by one noisy signal.
  const allFeatureGroupsMatch = groupResults.every(group => group.matched.length > 0)

  const requiredMisses = conditions.filter(
    condition => condition.required && !conditionMatches(condition, analysis, face, hands),
  ).length

  const strongestConfidence = Math.max(...groupResults.map(group => group.groupScore), 0)
  const confidenceGate = groupResults.length > 1 ? STRICT_CONFIDENCE_GATE : 0.62

  // Strict mode: every enabled feature group must be genuinely present.
  // Required conditions still act as an explicit extra guard, but optional
  // enabled conditions are no longer allowed to be silently ignored.
  const allEnabledConditionsMatch = conditions.every(condition =>
    conditionMatches(condition, analysis, face, hands),
  )

  const triggered = hasPrimarySignal &&
    weakestSignal >= confidenceGate &&
    strongestConfidence >= confidenceGate &&
    allFeatureGroupsMatch &&
    allEnabledConditionsMatch &&
    requiredMisses === 0 &&
    score >= TRIGGER_THRESHOLD

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
  const [debug, setDebug] = useState<MemeTriggerDebug>({
    candidateId: null,
    candidateScore: 0,
    candidateSamples: 0,
    confirmationNeeded: 0,
    stableId: null,
    stableScore: 0,
    lockRemainingMs: 0,
  })
  const candidateIdRef = useRef<string | null>(null)
  const candidateCountRef = useRef(0)
  const stableIdRef = useRef<string | null>(null)
  const stableScoreRef = useRef(0)
  const stableBelowReleaseCountRef = useRef(0)
  const missCountRef = useRef(0)
  const lastSwitchAtRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setMatches([])
      candidateIdRef.current = null
      candidateCountRef.current = 0
      stableIdRef.current = null
      stableScoreRef.current = 0
      missCountRef.current = 0
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
      const currentMatch = stableIdRef.current
        ? freshMatches.find(match => match.meme.id === stableIdRef.current) ?? null
        : null
      const instantCandidate = candidate?.meme.trigger.conditions.some(condition => condition.enabled !== false && condition.feature === 'mouth' && condition.value === 'tongue-out') ?? false
      const confirmationNeeded = candidate ? (instantCandidate ? 1 : SWITCH_CONFIRM_SAMPLES) : 0

      setDebug({
        candidateId: candidate?.meme.id ?? null,
        candidateScore: candidate?.score ?? 0,
        candidateSamples: candidate && candidateIdRef.current === candidate.meme.id ? candidateCountRef.current : 1,
        confirmationNeeded,
        stableId: stableIdRef.current,
        stableScore: stableScoreRef.current,
        lockRemainingMs: 0,
      })

      // Winner arbitration:
      // 1. A meme must satisfy ALL enabled conditions.
      // 2. Once a meme wins, another meme cannot steal it just because it
      //    scores a little higher.
      // 3. The current meme must actually release before a normal switch.
      // 4. A replacement needs several consecutive frames of confirmation.
      // This prevents overlapping expressions/gestures from fighting.
      if (!candidate) {
        missCountRef.current += 1
        if (stableIdRef.current && missCountRef.current < MISS_LIMIT) {
          const held = getAllMemes().find(meme => meme.id === stableIdRef.current)
          if (held) {
            setMatches([{ meme: held, score: Math.max(EXIT_SCORE, stableScoreRef.current), matched: 0, total: held.trigger.conditions.length }])
            return
          }
        }

        setMatches([])
        stableIdRef.current = null
        stableScoreRef.current = 0
        candidateIdRef.current = null
        candidateCountRef.current = 0
        missCountRef.current = 0
        return
      }

      missCountRef.current = 0

      if (stableIdRef.current === candidate.meme.id) {
        candidateIdRef.current = candidate.meme.id
        candidateCountRef.current += 1
        stableScoreRef.current = candidate.score
        stableBelowReleaseCountRef.current = candidate.score < RELEASE_SCORE
          ? stableBelowReleaseCountRef.current + 1
          : 0

        setMatches([candidate])
        return
      }

      // No current winner: require a clean confirmation before the first fire.
      if (!stableIdRef.current) {
        if (candidateIdRef.current !== candidate.meme.id) {
          candidateIdRef.current = candidate.meme.id
          candidateCountRef.current = 1
        } else {
          candidateCountRef.current += 1
        }

        if (candidateCountRef.current >= confirmationNeeded) {
          stableIdRef.current = candidate.meme.id
          stableScoreRef.current = candidate.score
          stableBelowReleaseCountRef.current = 0
          lastSwitchAtRef.current = now
          setMatches([candidate])
        } else {
          setMatches([])
        }
        return
      }

      const currentScore = currentMatch?.score ?? 0
      const currentReleased = !currentMatch || currentScore < RELEASE_SCORE
      if (currentReleased) {
        stableBelowReleaseCountRef.current += 1
      } else {
        stableBelowReleaseCountRef.current = 0
      }

      // A competing meme needs both temporal confirmation and a meaningful
      // score advantage. This is the "stopper": the old meme owns the overlay
      // until it releases, rather than letting every partial overlap replace it.
      if (candidateIdRef.current !== candidate.meme.id) {
        candidateIdRef.current = candidate.meme.id
        candidateCountRef.current = 1
      } else {
        candidateCountRef.current += 1
      }

      const confirmed = candidateCountRef.current >= (instantCandidate ? 1 : SWITCH_CONFIRM_SAMPLES)
      const takeoverMarginMet = candidate.score >= currentScore + TAKEOVER_MARGIN
      const cooldownOver = now - lastSwitchAtRef.current >= SWITCH_COOLDOWN_MS
      const mayTakeOver = confirmed && (instantCandidate || cooldownOver) &&
        (instantCandidate || stableBelowReleaseCountRef.current >= RELEASE_SAMPLE_LIMIT || takeoverMarginMet)

      if (mayTakeOver) {
        stableIdRef.current = candidate.meme.id
        stableScoreRef.current = candidate.score
        stableBelowReleaseCountRef.current = 0
        lastSwitchAtRef.current = now
        setMatches([candidate])
      } else {
        const held = getAllMemes().find(meme => meme.id === stableIdRef.current)
        if (held) {
          setMatches([{
            meme: held,
            score: Math.max(EXIT_SCORE, stableScoreRef.current),
            matched: 0,
            total: held.trigger.conditions.length,
          }])
        }
      }
    }

    update()
    const interval = window.setInterval(update, 100)
    return () => window.clearInterval(interval)
  }, [analysis, enabled, faceLandmarks, handLandmarks])

  return { matches, topMatch: matches[0] ?? null, debug }
}
