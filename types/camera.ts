export type CameraStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unavailable' | 'error'
export type CameraFacingMode = 'user' | 'environment'

export interface CameraDevice {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

export interface CameraState {
  status: CameraStatus
  deviceId?: string
  facingMode: CameraFacingMode
  error?: string
}
