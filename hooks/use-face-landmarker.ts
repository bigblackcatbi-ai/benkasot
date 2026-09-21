'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export interface FaceDetectionState {
  status: 'idle' | 'loading' | 'active' | 'error'
  faceDetected: boolean
  faceCount: number
  landmarkCount: number
  error?: string
}

export function useFaceLandmarker(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const frameRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)
  const mountedRef = useRef(false)
  const lastTimestampRef = useRef(-1)
  const landmarksRef = useRef<NormalizedLandmark[][]>([])

  const [state, setState] = useState<FaceDetectionState>({
    status: 'idle',
    faceDetected: false,
    faceCount: 0,
    landmarkCount: 0,
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
      setState({ status: 'idle', faceDetected: false, faceCount: 0, landmarkCount: 0 })
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
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'VIDEO',
          numFaces: 1,
        })

        if (cancelled || !mountedRef.current || requestId !== requestIdRef.current) {
          landmarker.close()
          return
        }

        landmarkerRef.current = landmarker
        lastTimestampRef.current = -1

        let lastFaceCount = -1
        let lastLandmarkCount = -1

        const processFrame = () => {
          if (cancelled || !mountedRef.current || requestId !== requestIdRef.current) return

          const currentVideo = videoRef.current
          const currentLandmarker = landmarkerRef.current

          if (!currentVideo || !currentLandmarker) return

          if (currentVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const timestamp = Math.max(performance.now(), lastTimestampRef.current + 1)
            lastTimestampRef.current = timestamp

            const result = currentLandmarker.detectForVideo(currentVideo, timestamp)
            landmarksRef.current = result.faceLandmarks
            const faceCount = result.faceLandmarks.length
            const landmarkCount = faceCount > 0 ? result.faceLandmarks[0].length : 0

            if (faceCount !== lastFaceCount || landmarkCount !== lastLandmarkCount) {
              lastFaceCount = faceCount
              lastLandmarkCount = landmarkCount
              setState({
                status: 'active',
                faceDetected: faceCount > 0,
                faceCount,
                landmarkCount,
              })
            }
          }

          frameRef.current = requestAnimationFrame(processFrame)
        }

        landmarksRef.current = []
        setState({ status: 'active', faceDetected: false, faceCount: 0, landmarkCount: 0 })
        frameRef.current = requestAnimationFrame(processFrame)
      } catch (error) {
        if (cancelled || !mountedRef.current || requestId !== requestIdRef.current) return
        dispose()
        setState({
          status: 'error',
          faceDetected: false,
          faceCount: 0,
          landmarkCount: 0,
          error: error instanceof Error ? error.message : 'Unable to initialize face detection.',
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
