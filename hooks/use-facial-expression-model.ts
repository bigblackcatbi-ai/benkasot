'use client'

import { useEffect, useRef, useState } from 'react'
import * as faceapi from '@vladmandic/face-api'
import type { FaceExpression } from '@/hooks/use-expression-gesture-detection'

export type FacialExpressionModelState = {
  expression: FaceExpression
  confidence: number
  probabilities: Record<string, number>
  status: 'loading' | 'ready' | 'detecting' | 'error' | 'idle'
  error?: string
}

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model'

const EMPTY_PROBABILITIES: Record<string, number> = {
  neutral: 0,
  happy: 0,
  sad: 0,
  angry: 0,
  fearful: 0,
  disgusted: 0,
  surprised: 0,
}

const NO_FACE: FacialExpressionModelState = {
  expression: 'NO FACE',
  confidence: 0,
  probabilities: EMPTY_PROBABILITIES,
  status: 'idle',
}

const normalizeExpression = (expressions: faceapi.FaceExpressions): { expression: FaceExpression; confidence: number; probabilities: Record<string, number> } => {
  const probabilities = {
    neutral: expressions.neutral,
    happy: expressions.happy,
    sad: expressions.sad,
    angry: expressions.angry,
    fearful: expressions.fearful,
    disgusted: expressions.disgusted,
    surprised: expressions.surprised,
  }

  const candidates = [
    { key: 'happy', expression: 'HAPPY' as const },
    { key: 'sad', expression: 'SAD' as const },
    { key: 'angry', expression: 'ANGRY' as const },
    { key: 'surprised', expression: 'SURPRISED' as const },
    { key: 'neutral', expression: 'NEUTRAL' as const },
  ].sort((a, b) => probabilities[b.key] - probabilities[a.key])

  const best = candidates[0]
  const second = candidates[1]
  const margin = best ? best.expression === 'NEUTRAL'
    ? probabilities.neutral - (second ? probabilities[second.key] : 0)
    : probabilities[best.key] - (second ? probabilities[second.key] : 0)
    : 0

  // Do not map fearful/disgusted to our meme emotions. If the model is
  // uncertain or splits probability across classes, return NEUTRAL so the
  // app does not fire the wrong meme.
  const minimumConfidence = best.expression === 'NEUTRAL' ? 0.50 : 0.62
  const minimumMargin = best.expression === 'NEUTRAL' ? 0.08 : 0.10
  if (best.expression !== 'NEUTRAL' && (probabilities[best.key] < minimumConfidence || margin < minimumMargin)) {
    return { expression: 'NEUTRAL', confidence: 0.30, probabilities }
  }

  return {
    expression: best.expression,
    confidence: Math.min(0.99, probabilities[best.key]),
    probabilities,
  }
}

export function useFacialExpressionModel(videoRef: React.MutableRefObject<HTMLVideoElement | null>, enabled: boolean): FacialExpressionModelState & {
  expressionRef: React.MutableRefObject<{ expression: FaceExpression; confidence: number; probabilities: Record<string, number> }>
} {
  const expressionRef = useRef({ expression: 'NO FACE' as FaceExpression, confidence: 0, probabilities: EMPTY_PROBABILITIES })
  const [state, setState] = useState<FacialExpressionModelState>(NO_FACE)
  const runningRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    if (!enabled) {
      expressionRef.current = { expression: 'NO FACE', confidence: 0, probabilities: EMPTY_PROBABILITIES }
      setState(NO_FACE)
      return () => { cancelled = true }
    }

    const load = async () => {
      try {
        setState(s => ({ ...s, status: 'loading', error: undefined }))
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ])
        if (!cancelled && mountedRef.current) setState(s => ({ ...s, status: 'ready' }))
      } catch (error) {
        if (!cancelled && mountedRef.current) {
          setState({ ...NO_FACE, status: 'error', error: error instanceof Error ? error.message : 'Unable to load expression model.' })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const interval = window.setInterval(async () => {
      if (cancelled || runningRef.current || !videoRef.current || videoRef.current.readyState < 2) return
      if (!faceapi.nets.tinyFaceDetector.isLoaded || !faceapi.nets.faceExpressionNet.isLoaded) return

      runningRef.current = true
      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.55 }))
          .withFaceExpressions()

        if (cancelled) return

        if (!detection) {
          expressionRef.current = { expression: 'NO FACE', confidence: 0, probabilities: EMPTY_PROBABILITIES }
          setState(s => ({ ...s, expression: 'NO FACE', confidence: 0, probabilities: EMPTY_PROBABILITIES, status: 'detecting' }))
          return
        }

        const result = normalizeExpression(detection.expressions)
        expressionRef.current = result
        setState({ ...result, status: 'detecting' })
      } catch (error) {
        if (!cancelled) setState(s => ({ ...s, status: 'error', error: error instanceof Error ? error.message : 'Expression detection failed.' }))
      } finally {
        runningRef.current = false
      }
    }, 120)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [enabled, videoRef])

  return { ...state, expressionRef }
}
