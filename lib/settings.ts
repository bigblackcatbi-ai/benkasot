export interface AppSettings {
  // Run MediaPipe face + hand detection.
  detection: boolean
  // Render the AR meme overlay on the live camera viewport.
  arOverlay: boolean
  // Preferred camera deviceId, applied the next time the camera opens.
  preferredDeviceId: string | null
}

const STORAGE_KEY = 'benkasot:settings:v1'

export const defaultSettings: AppSettings = {
  detection: true,
  arOverlay: true,
  preferredDeviceId: null,
}

export function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...defaultSettings, ...parsed }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore quota / unavailable storage; the in-memory value still applies.
  }
}
