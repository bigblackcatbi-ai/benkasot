'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

export interface HandDetectionState {
  status: 'idle' | 'loading' | 'active' | 'error'
  handDetected: boolean
  handCount: number
  landmarkCount: number
  leftHandDetected: boolean
  rightHandDetected: boolean
  error?: string
}

export function useHandLandmarker(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const frameRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(false)
  const lastTimestampRef = useRef(-1)
  const landmarksRef = useRef<NormalizedLandmark[][]>([])

  const [state, setState] = useState<HandDetectionState>({
    status: 'idle',
    handDetected: false,
    handCount: 0,
    landmarkCount: 0,
    leftHandDetected: false,
    rightHandDetected: false,
  })

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
  }, [])

  const dispose = useCallback(() => {
    stopLoop()
    landmarkerRef.current?.close()
    landmarkerRef.current = null
  }, [stopLoop])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      dispose()
    }
  }, [dispose])

  useEffect(() => {
    if (!enabled) {
      dispose()
      landmarksRef.current = []
      setState({
        status: 'idle',
        handDetected: false,
        handCount: 0,
        landmarkCount: 0,
        leftHandDetected: false,
        rightHandDetected: false,
      })
      return
    }

    const video = videoRef.current
    if (!video) return

    const requestId = ++requestIdRef.current
    let cancelled = false

    const run = async () => {
      setState((current) => ({ ...current, status: 'loading', error: undefined }))

      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'VIDEO',
          numHands: 2,
        })

        if (cancelled || !mountedRef.current || requestId !== requestIdRef.current) {
          landmarker.close()
          return
        }

        landmarkerRef.current = landmarker
        lastTimestampRef.current = -1

        let lastSignature = ''

        const processFrame = () => {
          if (cancelled || !mountedRef.current || requestId !== requestIdRef.current) return

          const currentVideo = videoRef.current
          const currentLandmarker = landmarkerRef.current

          if (!currentVideo || !currentLandmarker) return

          if (currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const timestamp = Math.max(performance.now(), lastTimestampRef.current + 1)
            lastTimestampRef.current = timestamp

            const result = currentLandmarker.detectForVideo(currentVideo, timestamp)
            landmarksRef.current = result.landmarks
            const handCount = result.landmarks.length
            const landmarkCount = handCount * 21
            const handedness = result.handednesses.flat()

            const leftHandDetected = handedness.some((category) => category.categoryName === 'Left')
            const rightHandDetected = handedness.some((category) => category.categoryName === 'Right')
            const signature = [handCount, landmarkCount, leftHandDetected, rightHandDetected].join(':')

            if (signature !== lastSignature) {
              lastSignature = signature
              setState({
                status: 'active',
                handDetected: handCount > 0,
                handCount,
                landmarkCount,
                leftHandDetected,
                rightHandDetected,
              })
            }
          }

          frameRef.current = requestAnimationFrame(processFrame)
        }

        landmarksRef.current = []
        setState({
          status: 'active',
          handDetected: false,
          handCount: 0,
          landmarkCount: 0,
          leftHandDetected: false,
          rightHandDetected: false,
        })
        frameRef.current = requestAnimationFrame(processFrame)
      } catch (error) {
        if (cancelled || !mountedRef.current || requestId !== requestIdRef.current) return
        dispose()
        setState({
          status: 'error',
          handDetected: false,
          handCount: 0,
          landmarkCount: 0,
          leftHandDetected: false,
          rightHandDetected: false,
          error: error instanceof Error ? error.message : 'Unable to initialize hand detection.',
        })
      }
    }

    void run()

    return () => {
      cancelled = true
      requestIdRef.current += 1
      dispose()
    }
  }, [dispose, enabled, videoRef])

  return { ...state, landmarksRef }
}
