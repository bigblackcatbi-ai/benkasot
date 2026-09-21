'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { LearnedGestureProfile } from '@/types/learned-gesture'

type Handedness = 'Left' | 'Right' | 'Hand'

interface LearnedGestureMatch {
  profile: LearnedGestureProfile
  score: number
}

const SAMPLE_INTERVAL = 120
const RECORD_DURATION = 3000
const MATCH_DISTANCE = 0.18

function canonicalize(hand: NormalizedLandmark[], handedness: Handedness) {
  if (hand.length < 21) return null
  const wrist = hand[0]
  const palm = Math.max(Math.hypot(hand[0].x - hand[9].x, hand[0].y - hand[9].y), 0.001)

  return hand.slice(0, 21).map(point => ({
    x: ((handedness === 'Left' ? -1 : 1) * (point.x - wrist.x)) / palm,
    y: (point.y - wrist.y) / palm,
    z: (point.z - (wrist.z ?? 0)) / palm,
  }))
}

function averageSamples(samples: Array<Array<{ x: number; y: number; z: number }>>) {
  return samples[0].map((_, index) => ({
    x: samples.reduce((sum, sample) => sum + sample[index].x, 0) / samples.length,
    y: samples.reduce((sum, sample) => sum + sample[index].y, 0) / samples.length,
    z: samples.reduce((sum, sample) => sum + sample[index].z, 0) / samples.length,
  }))
}

function compare(current: Array<{ x: number; y: number; z: number }>, target: LearnedGestureProfile['landmarks']) {
  if (current.length !== target.length) return 0
  const distance = current.reduce((sum, point, index) => {
    const targetPoint = target[index]
    return sum + Math.hypot(point.x - targetPoint.x, point.y - targetPoint.y, (point.z - targetPoint.z) * 0.5)
  }, 0) / current.length

  return Math.max(0, Math.min(100, Math.round((1 - distance / MATCH_DISTANCE) * 100)))
}

export function useLearnedGesture(
  handLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  handedness: React.MutableRefObject<string[]>,
  enabled: boolean,
) {
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sampleCount, setSampleCount] = useState(0)
  const [recordedLandmarks, setRecordedLandmarks] = useState<LearnedGestureProfile['landmarks'] | null>(null)
  const [recordedHandedness, setRecordedHandedness] = useState<'Left' | 'Right' | 'Any'>('Any')
  const [matches, setMatches] = useState<LearnedGestureMatch[]>([])
  const samplesRef = useRef<Array<Array<{ x: number; y: number; z: number }>>>([])
  const handednessRef = useRef<'Left' | 'Right' | 'Any'>('Any')
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const clearRecording = useCallback(() => {
    setRecordedLandmarks(null)
    setRecordedHandedness('Any')
    setSampleCount(0)
    setProgress(0)
    samplesRef.current = []
  }, [])

  const startRecording = useCallback(() => {
    if (!enabled || recording) return
    samplesRef.current = []
    handednessRef.current = 'Any'
    startedAtRef.current = performance.now()
    setRecordedLandmarks(null)
    setSampleCount(0)
    setProgress(0)
    setRecording(true)
  }, [enabled, recording])

  useEffect(() => {
    if (!recording || !enabled) return

    const tick = () => {
      const elapsed = performance.now() - startedAtRef.current
      const ratio = Math.min(1, elapsed / RECORD_DURATION)
      setProgress(Math.round(ratio * 100))

      const handIndex = handLandmarks.current.findIndex(hand => hand.length >= 21)
      if (handIndex >= 0) {
        const label = handedness.current[handIndex] === 'Left' || handedness.current[handIndex] === 'Right'
          ? handedness.current[handIndex] as 'Left' | 'Right'
          : 'Any'
        const normalized = canonicalize(handLandmarks.current[handIndex], label)
        if (normalized) {
          samplesRef.current.push(normalized)
          if (label !== 'Any') handednessRef.current = label
          setSampleCount(samplesRef.current.length)
        }
      }

      if (elapsed >= RECORD_DURATION) {
        const samples = samplesRef.current
        if (samples.length >= 5) {
          setRecordedLandmarks(averageSamples(samples))
          setRecordedHandedness(handednessRef.current)
          setProgress(100)
        }
        setRecording(false)
      }
    }

    timerRef.current = window.setInterval(tick, SAMPLE_INTERVAL)
    tick()

    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [recording, enabled, handLandmarks, handedness])

  useEffect(() => {
    if (!enabled || !recordedLandmarks) {
      setMatches([])
      return
    }

    const update = () => {
      const next: LearnedGestureMatch[] = []
      handLandmarks.current.forEach((hand, index) => {
        const label = handedness.current[index] === 'Left' || handedness.current[index] === 'Right'
          ? handedness.current[index] as 'Left' | 'Right'
          : 'Any'
        const normalized = canonicalize(hand, label)
        if (!normalized) return

        const profiles = window.__MEME_VISION_LEARNED_GESTURES__ ?? []
        profiles.forEach(profile => {
          if (profile.handedness !== 'Any' && label !== 'Any' && profile.handedness !== label) return
          const score = compare(normalized, profile.landmarks)
          if (score >= 60) next.push({ profile, score })
        })
      })
      setMatches(next.sort((a, b) => b.score - a.score).slice(0, 3))
    }

    const interval = window.setInterval(update, 150)
    update()
    return () => window.clearInterval(interval)
  }, [enabled, recordedLandmarks, handLandmarks, handedness])

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
    }
  }, [])

  return {
    recording,
    progress,
    sampleCount,
    recordedLandmarks,
    recordedHandedness,
    matches,
    startRecording,
    clearRecording,
    recordDurationMs: RECORD_DURATION,
  }
}
