'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CameraDevice, CameraFacingMode, CameraStatus } from '@/types/camera'

const CAMERA_MESSAGES = {
  denied: 'Camera permission is required to use MEME//VISION.',
  unavailable: 'No camera was detected on this device.',
  unreadable: 'The camera is currently unavailable. Another application may be using it.',
  security: 'Camera access was blocked by the browser or security policy.',
  generic: 'Unable to start the camera.',
} as const

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

function getCameraError(error: unknown): { status: CameraStatus; message: string } {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return { status: 'denied', message: CAMERA_MESSAGES.denied }
      case 'NotFoundError':
        return { status: 'unavailable', message: CAMERA_MESSAGES.unavailable }
      case 'NotReadableError':
        return { status: 'error', message: CAMERA_MESSAGES.unreadable }
      case 'SecurityError':
        return { status: 'error', message: CAMERA_MESSAGES.security }
    }
  }

  return { status: 'error', message: CAMERA_MESSAGES.generic }
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(false)
  const requestIdRef = useRef(0)
  const startingRef = useRef(false)

  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string>()
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>()
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user')

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return []

    const allDevices = await navigator.mediaDevices.enumerateDevices()
    const videoInputs = allDevices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || 'Camera',
        kind: device.kind,
      }))

    if (mountedRef.current) {
      setDevices(videoInputs)
      setSelectedDeviceId((current) => current || videoInputs[0]?.deviceId)
    }

    return videoInputs
  }, [])

  const stop = useCallback(() => {
    requestIdRef.current += 1
    startingRef.current = false
    stopStream(streamRef.current)
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (mountedRef.current) {
      setStatus('idle')
      setError(undefined)
    }
  }, [])

  const start = useCallback(async (deviceId?: string) => {
    if (!mountedRef.current || startingRef.current || streamRef.current) return

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable')
      setError('Camera access is not supported by this browser or page context.')
      return
    }

    const requestId = ++requestIdRef.current
    startingRef.current = true
    setStatus('requesting')
    setError(undefined)

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : { facingMode: { ideal: 'user' } },
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        stopStream(stream)
        return
      }

      streamRef.current = stream

      const track = stream.getVideoTracks()[0]
      const settings = track?.getSettings()
      const actualDeviceId = settings?.deviceId

      if (actualDeviceId) setSelectedDeviceId(actualDeviceId)
      if (settings?.facingMode === 'environment') setFacingMode('environment')
      else if (settings?.facingMode === 'user') setFacingMode('user')

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }

      await refreshDevices()
      if (mountedRef.current && requestId === requestIdRef.current) {
        setStatus('active')
      }
    } catch (cameraError) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      const mapped = getCameraError(cameraError)
      setStatus(mapped.status)
      setError(mapped.message)
    } finally {
      if (requestId === requestIdRef.current) startingRef.current = false
    }
  }, [refreshDevices])

  const selectDevice = useCallback(async (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    if (!streamRef.current) {
      await start(deviceId)
      return
    }

    stop()
    await start(deviceId)
  }, [start, stop])

  useEffect(() => {
    mountedRef.current = true

    const handleDeviceChange = () => {
      void refreshDevices()
    }

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    }

    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      startingRef.current = false
      stopStream(streamRef.current)
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null

      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
      }
    }
  }, [refreshDevices])

  return {
    videoRef,
    status,
    error,
    devices,
    selectedDeviceId,
    facingMode,
    start,
    stop,
    selectDevice,
    refreshDevices,
  }
}
