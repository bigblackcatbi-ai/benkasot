'use client'

import { useEffect, useRef, useState } from 'react'
import { pipeline } from '@huggingface/transformers'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type FerEmotion = 'angry' | 'disgust' | 'fear' | 'happy' | 'neutral' | 'sad' | 'surprise'

export interface FerProbabilities {
  angry: number
  disgust: number
  fear: number
  happy: number
  neutral: number
  sad: number
  surprise: number
}

export interface FerState {
  status: 'idle' | 'loading' | 'ready' | 'running' | 'error'
  expression: FerEmotion | 'NO FACE'
  confidence: number
  probabilities: FerProbabilities
  error: string | null
}

type ImageClassifier = (image: HTMLCanvasElement) => Promise<Array<{ label?: string; score?: number }>>

const MODEL_ID = 'onnx-community/face-emotion-detection-ONNX'
const EMA_ALPHA = 0.35
const SWITCH_MARGIN = 0.08
const SWITCH_CONFIRM_MS = 300
const INFERENCE_INTERVAL_MS = 120
const EMOTIONS: FerEmotion[] = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

const emptyProbabilities = (): FerProbabilities => ({
  angry: 0, disgust: 0, fear: 0, happy: 0, neutral: 0, sad: 0, surprise: 0,
})

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

function smoothProbabilities(previous: FerProbabilities, next: FerProbabilities): FerProbabilities {
  return EMOTIONS.reduce((result, emotion) => {
    result[emotion] = previous[emotion] === 0
      ? next[emotion]
      : previous[emotion] * (1 - EMA_ALPHA) + next[emotion] * EMA_ALPHA
    return result
  }, { ...previous })
}

function getTopTwo(probabilities: FerProbabilities) {
  const ranked = EMOTIONS
    .map(emotion => ({ emotion, score: probabilities[emotion] }))
    .sort((a, b) => b.score - a.score)
  return {
    best: ranked[0].emotion,
    bestScore: ranked[0].score,
    secondScore: ranked[1]?.score ?? 0,
  }
}

function cropFace(video: HTMLVideoElement, face: NormalizedLandmark[], canvas: HTMLCanvasElement) {
  if (face.length < 400 || !video.videoWidth || !video.videoHeight) return false

  const points = face.slice(0, 468)
  const minX = Math.min(...points.map(point => point.x))
  const maxX = Math.max(...points.map(point => point.x))
  const minY = Math.min(...points.map(point => point.y))
  const maxY = Math.max(...points.map(point => point.y))
  const centerX = ((minX + maxX) / 2) * video.videoWidth
  const centerY = ((minY + maxY) / 2) * video.videoHeight
  const size = Math.max((maxX - minX) * video.videoWidth, (maxY - minY) * video.videoHeight) * 1.2
  const sx = Math.max(0, Math.min(video.videoWidth - size, centerX - size / 2))
  const sy = Math.max(0, Math.min(video.videoHeight - size, centerY - size / 2))
  const sw = Math.min(size, video.videoWidth - sx)
  const sh = Math.min(size, video.videoHeight - sy)

  canvas.width = 224
  canvas.height = 224
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  ctx.clearRect(0, 0, 224, 224)
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 224, 224)
  return true
}

function mapResults(results: Array<{ label?: string; score?: number }>): FerProbabilities {
  const probabilities = emptyProbabilities()
  const indexToEmotion: FerEmotion[] = ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']

  results.forEach(result => {
    const label = (result.label ?? '').toLowerCase()
    const digits = label.replace(/[^0-9]/g, '')
    const byIndex = digits ? indexToEmotion[Number(digits)] : undefined
    const byName = EMOTIONS.find(emotion => label.includes(emotion))
    const emotion = byIndex ?? byName
    if (emotion) probabilities[emotion] = clamp01(result.score ?? 0)
  })

  return probabilities
}

export function useFacialExpressionFER(
  faceLandmarks: React.MutableRefObject<NormalizedLandmark[][]>,
  videoRef: React.MutableRefObject<HTMLVideoElement | null>,
  enabled: boolean,
): FerState {
  const [state, setState] = useState<FerState>({
    status: 'idle',
    expression: 'NO FACE',
    confidence: 0,
    probabilities: emptyProbabilities(),
    error: null,
  })

  const classifierRef = useRef<ImageClassifier | null>(null)
  const loadingRef = useRef<Promise<void> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const inFlightRef = useRef(false)
  const smoothedRef = useRef<FerProbabilities>(emptyProbabilities())
  const stableEmotionRef = useRef<FerEmotion | 'NO FACE'>('NO FACE')
  const pendingEmotionRef = useRef<FerEmotion | null>(null)
  const pendingSinceRef = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', expression: 'NO FACE', confidence: 0, probabilities: emptyProbabilities(), error: null })
      classifierRef.current = null
      loadingRef.current = null
      inFlightRef.current = false
      smoothedRef.current = emptyProbabilities()
      stableEmotionRef.current = 'NO FACE'
      pendingEmotionRef.current = null
      pendingSinceRef.current = 0
      return
    }

    let cancelled = false

    const load = async () => {
      if (classifierRef.current || loadingRef.current) return
      setState(current => ({ ...current, status: 'loading', error: null }))

      loadingRef.current = (async () => {
        try {
          const device = typeof navigator !== 'undefined' && 'gpu' in navigator ? 'webgpu' : 'wasm'
          const classifier = await pipeline('image-classification', MODEL_ID, { device, dtype: 'q8' })
          if (cancelled) return
          classifierRef.current = classifier as unknown as ImageClassifier
          setState(current => ({ ...current, status: 'ready' }))
        } catch (error) {
          if (!cancelled) setState(current => ({ ...current, status: 'error', error: error instanceof Error ? error.message : 'Could not load the FER model.' }))
        } finally {
          loadingRef.current = null
        }
      })()
    }

    void load()

    const runInference = async () => {
      const video = videoRef.current
      const face = faceLandmarks.current[0]
      const classifier = classifierRef.current
      if (!video || !face || face.length < 400 || !classifier || inFlightRef.current || video.readyState < 2) return

      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'))
      if (!cropFace(video, face, canvas)) return

      inFlightRef.current = true
      try {
        const results = await classifier(canvas)
        if (cancelled) return

        const raw = mapResults(results)
        const smoothed = smoothProbabilities(smoothedRef.current, raw)
        smoothedRef.current = smoothed

        const { best, bestScore, secondScore } = getTopTwo(smoothed)
        const now = performance.now()
        const marginMet = bestScore - secondScore >= SWITCH_MARGIN

        if (best !== pendingEmotionRef.current) {
          pendingEmotionRef.current = best
          pendingSinceRef.current = now
        }

        if (
          stableEmotionRef.current === 'NO FACE' ||
          (marginMet && pendingEmotionRef.current === best && now - pendingSinceRef.current >= SWITCH_CONFIRM_MS)
        ) {
          stableEmotionRef.current = best
        }

        const stableScore = smoothed[stableEmotionRef.current === 'NO FACE' ? best : stableEmotionRef.current]
        setState({
          status: 'ready',
          expression: stableEmotionRef.current,
          confidence: stableScore,
          probabilities: smoothed,
          error: null,
        })
      } catch (error) {
        if (!cancelled) setState(current => ({ ...current, status: 'error', error: error instanceof Error ? error.message : 'FER inference failed.' }))
      } finally {
        inFlightRef.current = false
      }
    }

    const interval = window.setInterval(() => void runInference(), INFERENCE_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [enabled, faceLandmarks, videoRef])

  return state
}
