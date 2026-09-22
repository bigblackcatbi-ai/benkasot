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
  triggerActive: boolean
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

const TICK_MS = 100
const CONFIRMATION_FRAMES = 2
const COOLDOWN_MS = 200

function distance(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y,
    (a.z ?? 0) - (b.z ?? 0),
  )
}

/**
 * Checks ONE condition.
 */
function conditionMatches(
  condition: MemeCondition,
  analysis: VisionAnalysisState,
  face: NormalizedLandmark[] | undefined,
  hands: NormalizedLandmark[][],
): boolean {
  const value = condition.value

  // --------------------------------------------------
  // FACE SIZE
  // --------------------------------------------------

  const faceTop = face?.[10]
  const faceBottom = face?.[152]
  const mouthLeft = face?.[61]
  const mouthRight = face?.[291]
  const mouthTop = face?.[13]
  const mouthBottom = face?.[14]

  if (condition.feature === 'eyes') {
    if (value === 'squinting') {
      return (
        analysis.eyes === 'CLOSED' ||
        analysis.eyes.startsWith('WINK')
      )
    }

    if (value === 'wide') {
      return (
        analysis.eyes === 'OPEN' ||
        analysis.faceExpression === 'SURPRISED'
      )
    }

    if (value === 'closed') {
      return analysis.eyes === 'CLOSED'
    }

    return false
  }

  // --------------------------------------------------
  // MOUTH
  // --------------------------------------------------

  if (condition.feature === 'mouth') {
    if (value === 'open') {
      return analysis.mouth === 'OPEN'
    }

    if (value === 'closed' || value === 'neutral') {
      return analysis.mouth === 'CLOSED'
    }

    if (value === 'smiling') {
      return (
        analysis.mouth === 'SMILE' ||
        analysis.faceExpression === 'HAPPY'
      )
    }

    if (value === 'happy') {
      return analysis.faceExpression === 'HAPPY'
    }

    if (value === 'sad') {
      return analysis.faceExpression === 'SAD'
    }

    if (value === 'smirk') {
      return analysis.faceExpression === 'SMIRK'
    }

    return false
  }

  // --------------------------------------------------
  // EXPRESSION
  // --------------------------------------------------

  if (condition.feature === 'expression') {

    if (value === 'smiling') {
      return (
        analysis.faceExpression === 'HAPPY' ||
        analysis.mouth === 'SMILE'
      )
    }

    if (value === 'happy') {
      return analysis.faceExpression === 'HAPPY'
    }

    if (value === 'sad') {
      return analysis.faceExpression === 'SAD'
    }

    if (value === 'smirk') {
      return analysis.faceExpression === 'SMIRK'
    }

    return false
  }

  // --------------------------------------------------
  // GAZE
  // --------------------------------------------------

  if (condition.feature === 'gaze') {
    if (value === 'upward') {
      return analysis.headDirection === 'UP'
    }

    if (value === 'right') {
      return analysis.headDirection === 'RIGHT'
    }

    return false
  }

  // --------------------------------------------------
  // HANDS
  // --------------------------------------------------

  if (condition.feature === 'hands') {
    if (!hands.length || !faceTop || !faceBottom) {
      return false
    }

    /*
     * Face height gives us a scale that works at different
     * distances from the webcam.
     */
    const faceHeight = Math.max(
      0.001,
      Math.abs(faceBottom.y - faceTop.y),
    )

    const faceCenterX =
      ((mouthLeft?.x ?? 0.5) +
        (mouthRight?.x ?? 0.5)) /
      2

    /*
     * A hand is considered "on head" only when the
     * palm/fingertips are actually inside the upper
     * face/head region.
     */
    const isHandOnHead = (
      hand: NormalizedLandmark[],
    ) => {
      const wrist = hand[0]
      const indexTip = hand[8]
      const middleTip = hand[12]
      const ringTip = hand[16]
      const pinkyTip = hand[20]

      if (
        !wrist ||
        !indexTip ||
        !middleTip ||
        !ringTip ||
        !pinkyTip
      ) {
        return false
      }

      /*
       * Use fingertips rather than wrist.
       * This prevents a hand beside the head from
       * being incorrectly classified as "on head".
       */
      const tips = [
        indexTip,
        middleTip,
        ringTip,
        pinkyTip,
      ]

      const headZoneTop =
        faceTop.y - faceHeight * 0.35

      const headZoneBottom =
        faceTop.y + faceHeight * 0.28

      const insideHeadZone = tips.filter(
        (tip) =>
          tip.y >= headZoneTop &&
          tip.y <= headZoneBottom &&
          Math.abs(tip.x - faceCenterX) <
            faceHeight * 0.75,
      ).length

      /*
       * At least two fingertips must be inside
       * the head zone.
       */
      return insideHeadZone >= 2
    }

    if (
      value === 'hands-on-head' ||
      value === 'both-hands-near-head'
    ) {
      const handsOnHead =
        hands.filter(isHandOnHead).length

      return handsOnHead >= 2
    }

    if (value === 'hand-on-head') {
      return hands.some(isHandOnHead)
    }

    // ------------------------------------------------
    // BOTH HANDS LEFT OF CHEST
    // ------------------------------------------------

    if (
      value === 'hand-on-chest'
    ) {
      const leftChestHands =
        hands.filter((hand) => {
          const wrist = hand[0]

          if (!wrist) return false

          return (
            wrist.x <
            faceCenterX -
              faceHeight * 0.15
          )
        }).length

      return leftChestHands >= 2
    }

    // ------------------------------------------------
    // NORMAL HAND GESTURES
    // ------------------------------------------------

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

    const expectedGesture =
      gestureMap[value]

    if (!expectedGesture) {
      return false
    }

    return analysis.handGestures.some(
      (hand) =>
        hand.gesture === expectedGesture,
    )
  }

  // --------------------------------------------------
  // FINGER PLACEMENT
  // --------------------------------------------------

  if (condition.feature === 'finger') {
    if (
      !faceTop ||
      !faceBottom ||
      !mouthLeft ||
      !mouthRight ||
      !mouthTop ||
      !mouthBottom
    ) {
      return false
    }

    const faceHeight = Math.max(
      0.001,
      Math.abs(faceBottom.y - faceTop.y),
    )
    const faceCenterX =
      (mouthLeft.x + mouthRight.x) / 2

    const mouthCenterX =
      (mouthLeft.x + mouthRight.x) / 2

    const mouthCenterY =
      (mouthTop.y + mouthBottom.y) / 2

    const isNearMouth = (
      tip: NormalizedLandmark,
    ) => {
      const dx =
        tip.x - mouthCenterX

      const dy =
        tip.y - mouthCenterY

      /*
       * Mouth region.
       *
       * Much smaller than the old 0.16 radius.
       */
      const horizontal =
        Math.abs(dx) <
        faceHeight * 0.30

      const vertical =
        Math.abs(dy) <
        faceHeight * 0.22

      if (!horizontal || !vertical) {
        return false
      }

      /*
       * Extra protection:
       * fingertip must be below the eye/upper-face
       * region, so pointing at the eye cannot count
       * as mouth.
       */
      return (
        tip.y >
        faceTop.y +
          faceHeight * 0.35
      )
    }

    const isNearHead = (
      tip: NormalizedLandmark,
    ) => {
      /*
       * Head/forehead region is ABOVE the mouth.
       */
      const horizontal =
        Math.abs(
          tip.x - faceCenterX,
        ) <
        faceHeight * 0.65
        
        

      const vertical =
        tip.y >
          faceTop.y -
            faceHeight * 0.25 &&
        tip.y <
          faceTop.y +
            faceHeight * 0.32

      return horizontal && vertical
    }

    if (
      value ===
      'index-finger-near-mouth'
    ) {
      return hands.some((hand) => {
        const indexTip = hand[8]

        if (!indexTip) return false

        return isNearMouth(indexTip)
      })
    }

    if (
      value ===
      'index-finger-near-head'
    ) {
      return hands.some((hand) => {
        const indexTip = hand[8]

        if (!indexTip) return false

        /*
         * Explicitly reject the mouth region.
         */
        if (isNearMouth(indexTip)) {
          return false
        }

        return isNearHead(indexTip)
      })
    }

    if (
      value ===
      'index-finger-to-chest'
    ) {
      return hands.some((hand) => {
        const indexTip = hand[8]

        if (!indexTip) return false

        return (
          indexTip.y >
          mouthCenterY +
            faceHeight * 0.45
        )
      })
    }

    return false
  }

  // Movement is currently unsupported.
  if (condition.feature === 'movement') {
    return false
  }

  return false
}

/**
 * Evaluates ONE meme.
 *
 * Same feature = OR
 * Different features = AND
 *
 * Example:
 *
 * eyes A OR eyes B
 * AND
 * mouth C
 * AND
 * hands D
 */
function matchMeme(
  meme: Meme,
  analysis: VisionAnalysisState,
  face: NormalizedLandmark[] | undefined,
  hands: NormalizedLandmark[][],
): MemeMatch {
  const conditions = meme.trigger.conditions.filter(
    (condition) => condition.enabled !== false,
  )

  const features = [
    ...new Set(
      conditions.map((condition) => condition.feature),
    ),
  ]

  const groups = features.map((feature) =>
    conditions.filter(
      (condition) => condition.feature === feature,
    ),
  )

  // Only groups containing at least one required condition count.
  const requiredGroups = groups.filter((group) =>
    group.some((condition) => condition.required),
  )

  const total = requiredGroups.length

  // Invalid meme: no required triggers.
  if (!analysis.facePresent || total === 0) {
    return {
      meme,
      score: 0,
      matched: 0,
      total,
      triggerActive: false,
    }
  }

  let matched = 0

  for (const group of requiredGroups) {
    const groupMatches = group.some((condition) =>
      conditionMatches(
        condition,
        analysis,
        face,
        hands,
      ),
    )

    if (groupMatches) {
      matched += 1
    }
  }

  const score = Math.round(
    (matched / total) * 100,
  )

  const triggerActive =
    matched === total

  return {
    meme,
    score,
    matched,
    total,
    triggerActive,
  }
}

export function useMemeTriggerEngine(
  analysis: VisionAnalysisState,
  faceLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  enabled: boolean,
) {
  const [matches, setMatches] = useState<MemeMatch[]>([])
  const [activeMeme, setActiveMeme] = useState<Meme | null>(null)

  const [debug, setDebug] =
    useState<MemeTriggerDebug>({
      candidateId: null,
      candidateScore: 0,
      candidateSamples: 0,
      confirmationNeeded: CONFIRMATION_FRAMES,
      stableId: null,
      stableScore: 0,
      lockRemainingMs: 0,
    })

  // Always keep the newest analysis available to the
  // interval without recreating the interval.
  const analysisRef = useRef(analysis)

  // Currently displayed meme.
  const activeMemeIdRef =
    useRef<string | null>(null)

  // Meme currently being confirmed.
  const candidateIdRef =
    useRef<string | null>(null)

  // Number of consecutive full matches.
  const candidateFramesRef =
    useRef(0)

  // Prevent immediate re-trigger after losing a meme.
  const cooldownUntilRef =
    useRef(0)

  useEffect(() => {
    analysisRef.current = analysis
  }, [analysis])

  useEffect(() => {
    if (!enabled) {
      setMatches([])
      setActiveMeme(null)

      activeMemeIdRef.current = null
      candidateIdRef.current = null
      candidateFramesRef.current = 0
      cooldownUntilRef.current = 0

      return
    }

    const update = () => {
      const currentAnalysis =
        analysisRef.current

      const face =
        faceLandmarks.current[0]

      const hands =
        handLandmarks.current

      // ---------------------------------------
      // EVALUATE EVERY MEME
      // ---------------------------------------

      const allMatches = getAllMemes()
        .filter((meme) => meme.enabled)
        .map((meme) =>
          matchMeme(
            meme,
            currentAnalysis,
            face,
            hands,
          ),
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.matched - a.matched,
        )

      // Partial matches are useful for the UI/debug
      // panel, but NEVER activate a meme.
      const visibleMatches =
        allMatches.filter(
          (match) => match.matched > 0,
        )

      setMatches(
        visibleMatches.length
          ? visibleMatches
          : allMatches.slice(0, 4),
      )

      // ---------------------------------------
      // FIND ONLY FULL MATCHES
      // ---------------------------------------

      const completeMatches =
        allMatches.filter(
          (match) =>
            match.total > 0 &&
            match.matched === match.total &&
            match.triggerActive,
        )

      const currentTime = Date.now()

      // ---------------------------------------
      // ACTIVE MEME
      // ---------------------------------------

      if (activeMemeIdRef.current) {
        const activeMatch =
          completeMatches.find(
            (match) =>
              match.meme.id ===
              activeMemeIdRef.current,
          )

        // IMPORTANT:
        // If ALL of the active meme's required
        // triggers are still satisfied,
        // keep it. Do not switch memes.
        if (activeMatch) {
          setDebug((previous) => {
            const next = {
              candidateId:
                activeMatch.meme.id,
              candidateScore: 100,
              candidateSamples:
                CONFIRMATION_FRAMES,
              confirmationNeeded:
                CONFIRMATION_FRAMES,
              stableId:
                activeMemeIdRef.current,
              stableScore: 100,
              lockRemainingMs: 0,
            }

            if (
              previous.candidateId ===
                next.candidateId &&
              previous.candidateScore ===
                next.candidateScore &&
              previous.candidateSamples ===
                next.candidateSamples &&
              previous.stableId ===
                next.stableId &&
              previous.stableScore ===
                next.stableScore
            ) {
              return previous
            }

            return next
          })

          return
        }

        // ---------------------------------------
        // ACTIVE MEME LOST A REQUIRED TRIGGER
        // ---------------------------------------

        activeMemeIdRef.current = null
        setActiveMeme(null)

        candidateIdRef.current = null
        candidateFramesRef.current = 0

        cooldownUntilRef.current =
          currentTime + COOLDOWN_MS

        setDebug({
          candidateId: null,
          candidateScore: 0,
          candidateSamples: 0,
          confirmationNeeded:
            CONFIRMATION_FRAMES,
          stableId: null,
          stableScore: 0,
          lockRemainingMs:
            COOLDOWN_MS,
        })

        return
      }

      // ---------------------------------------
      // SHORT COOLDOWN
      // ---------------------------------------

      if (
        currentTime <
        cooldownUntilRef.current
      ) {
        const remaining =
          cooldownUntilRef.current -
          currentTime

        setDebug({
          candidateId: null,
          candidateScore: 0,
          candidateSamples: 0,
          confirmationNeeded:
            CONFIRMATION_FRAMES,
          stableId: null,
          stableScore: 0,
          lockRemainingMs: remaining,
        })

        return
      }

      // ---------------------------------------
      // NO ACTIVE MEME
      // FIND A NEW FULL MATCH
      // ---------------------------------------

      const candidate =
        completeMatches[0] ?? null

      if (!candidate) {
        candidateIdRef.current = null
        candidateFramesRef.current = 0

        const bestPartial =
          visibleMatches[0] ?? null

        setDebug({
          candidateId:
            bestPartial?.meme.id ?? null,
          candidateScore:
            bestPartial?.score ?? 0,
          candidateSamples: 0,
          confirmationNeeded:
            CONFIRMATION_FRAMES,
          stableId: null,
          stableScore: 0,
          lockRemainingMs: 0,
        })

        return
      }

      // ---------------------------------------
      // CONFIRM CANDIDATE
      // ---------------------------------------

      if (
        candidateIdRef.current ===
        candidate.meme.id
      ) {
        candidateFramesRef.current += 1
      } else {
        candidateIdRef.current =
          candidate.meme.id

        candidateFramesRef.current = 1
      }

      const samples =
        candidateFramesRef.current

      // ---------------------------------------
      // WAITING
      // ---------------------------------------

      if (
        samples <
        CONFIRMATION_FRAMES
      ) {
        setDebug({
          candidateId:
            candidate.meme.id,
          candidateScore: 100,
          candidateSamples: samples,
          confirmationNeeded:
            CONFIRMATION_FRAMES,
          stableId: null,
          stableScore: 0,
          lockRemainingMs: 0,
        })

        return
      }

      // ---------------------------------------
      // ACTIVATE
      // ---------------------------------------

      activeMemeIdRef.current =
        candidate.meme.id

      setActiveMeme(candidate.meme)

      setDebug({
        candidateId:
          candidate.meme.id,
        candidateScore: 100,
        candidateSamples:
          CONFIRMATION_FRAMES,
        confirmationNeeded:
          CONFIRMATION_FRAMES,
        stableId:
          candidate.meme.id,
        stableScore: 100,
        lockRemainingMs: 0,
      })
    }

    update()

    const interval =
      window.setInterval(
        update,
        TICK_MS,
      )

    return () =>
      window.clearInterval(interval)
  }, [
    enabled,
    faceLandmarks,
    handLandmarks,
  ])

  // IMPORTANT:
  // topMatch means the ACTIVE meme only.
  //
  // This prevents the UI from accidentally displaying
  // a 2/3 or 1/2 partial match as the actual meme.
  const activeMatch =
    activeMeme
      ? matches.find(
          (match) =>
            match.meme.id ===
              activeMeme.id &&
            match.matched ===
              match.total &&
            match.total > 0,
        ) ?? null
      : null

  return {
    matches,

    // NEVER return a partial match here.
    topMatch: activeMatch,

    activeMeme,

    debug,
  }
}