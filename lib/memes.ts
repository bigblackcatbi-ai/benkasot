import type { Meme } from '@/types/meme'
import * as storage from './meme-storage'

const defaultOverlay: Meme['overlay'] = {
  anchor: 'face',
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  opacity: 1,
  duration: 3000,
  animation: 'pop',
}

export const memes: readonly Meme[] = [
  {
    id: 'judging',
    name: 'JUDGING PEOPLE',
    shortLabel: 'JUDGING',
    description: 'A squinting, neutral reaction for silently judging the room.',
    triggerSummary: 'Squint + neutral mouth',
    typeLabel: 'FACE',
    imagePath: '/memes/judging.png',
    category: 'face',
    enabled: true,
    source: 'built-in',
    accentColor: 'yellow',
    mockConfidence: 84,
    trigger: {
      type: 'expression',
      conditions: [
        { feature: 'eyes', category: 'face', value: 'squinting', required: true },
        { feature: 'mouth', category: 'face', value: 'neutral', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'shocked',
    name: 'SHOCKED',
    shortLabel: 'SHOCKED',
    description: 'A full surprise reaction with both hands on the head.',
    triggerSummary: 'Hands on head + wide eyes + mouth open',
    typeLabel: 'FACE + HAND',
    imagePath: '/memes/shocked.png',
    category: 'combination',
    enabled: true,
    source: 'built-in',
    accentColor: 'pink',
    mockConfidence: 91,
    trigger: {
      type: 'combined',
      conditions: [
        { feature: 'hands', category: 'hand', value: 'hands-on-head', required: true },
        { feature: 'eyes', category: 'face', value: 'wide', required: true },
        { feature: 'mouth', category: 'face', value: 'open', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'what',
    name: 'WHAT?',
    shortLabel: 'WHAT?',
    description: 'A confused reaction with narrowed eyes and a closed mouth.',
    triggerSummary: 'Squint + mouth closed',
    typeLabel: 'FACE',
    imagePath: '/memes/what.png',
    category: 'face',
    enabled: true,
    source: 'built-in',
    accentColor: 'blue',
    mockConfidence: 79,
    trigger: {
      type: 'expression',
      conditions: [
        { feature: 'eyes', category: 'face', value: 'squinting', required: true },
        { feature: 'mouth', category: 'face', value: 'closed', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'yesss',
    name: 'YESSS',
    shortLabel: 'YESSS',
    description: 'An excited celebration with a fist and reverse smile expression.',
    triggerSummary: 'Fist + excited smile',
    typeLabel: 'HAND + MOVE',
    imagePath: '/memes/yesss.png',
    category: 'combination',
    enabled: true,
    source: 'built-in',
    accentColor: 'mint',
    mockConfidence: 88,
    trigger: {
      type: 'combined',
      conditions: [
        { feature: 'expression', category: 'face', value: 'happy', required: true },
        { feature: 'hands', category: 'hand', value: 'fist', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'who-me',
    name: 'WHO? ME?',
    shortLabel: 'WHO? ME?',
    description: 'A self-pointing reaction with an open mouth.',
    triggerSummary: 'Point to chest + open mouth',
    typeLabel: 'HAND',
    imagePath: '/memes/who-me.png',
    category: 'combination',
    enabled: true,
    source: 'built-in',
    accentColor: 'orange',
    mockConfidence: 82,
    trigger: {
      type: 'combined',
      conditions: [
        { feature: 'mouth', category: 'face', value: 'open', required: true },
        { feature: 'finger', category: 'hand', value: 'index-finger-to-chest', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'crying',
    name: 'CRYING',
    shortLabel: 'CRYING',
    description: 'A crying reaction with hands near the head and an open mouth.',
    triggerSummary: 'Hands near head + open mouth',
    typeLabel: 'FACE + HAND',
    imagePath: '/memes/crying.png',
    category: 'combination',
    enabled: true,
    source: 'built-in',
    accentColor: 'pink',
    mockConfidence: 76,
    trigger: {
      type: 'combined',
      conditions: [
        { feature: 'hands', category: 'hand', value: 'both-hands-near-head', required: true },
        { feature: 'expression', category: 'face', value: 'sad', required: true },
        { feature: 'mouth', category: 'face', value: 'open', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'monkey-thinking',
    name: 'MONKEY THINKING',
    shortLabel: 'MONKEY THINKING',
    description: 'A thinking reaction with a finger near the mouth and upward gaze.',
    triggerSummary: 'Finger near mouth + eyes up',
    typeLabel: 'FACE + HAND',
    imagePath: '/memes/monkey-thinking.png',
    category: 'combination',
    enabled: true,
    source: 'built-in',
    accentColor: 'yellow',
    mockConfidence: 87,
    trigger: {
      type: 'combined',
      conditions: [
        { feature: 'finger', category: 'hand', value: 'index-finger-near-mouth', required: true },
        { feature: 'gaze', category: 'face', value: 'upward', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'thinking',
    name: 'THINKING',
    shortLabel: 'THINKING',
    description: 'A smiling thought with an index finger near the head.',
    triggerSummary: 'Finger to head + smile',
    typeLabel: 'HAND',
    imagePath: '/memes/thinking.png',
    category: 'combination',
    enabled: true,
    source: 'built-in',
    accentColor: 'blue',
    mockConfidence: 81,
    trigger: {
      type: 'combined',
      conditions: [
        { feature: 'finger', category: 'hand', value: 'index-finger-near-head', required: true },
        { feature: 'expression', category: 'face', value: 'smiling', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'happy',
    name: 'HAPPY',
    shortLabel: 'HAPPY',
    description: 'A happy reaction with a hand on the head and a smile.',
    triggerSummary: 'Hand on head + smile',
    typeLabel: 'FACE + HAND',
    imagePath: '/memes/happy.png',
    category: 'combination',
    enabled: true,
    source: 'built-in',
    accentColor: 'mint',
    mockConfidence: 89,
    trigger: {
      type: 'combined',
      conditions: [
        { feature: 'hands', category: 'hand', value: 'hand-on-head', required: true },
        { feature: 'expression', category: 'face', value: 'smiling', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
  {
    id: 'monkey-surprised',
    name: 'MONKEY SURPRISED',
    shortLabel: 'MONKEY SURPRISED',
    description: 'A surprised reaction with both hands near the left chest and rightward gaze.',
    triggerSummary: 'Hands left + eyes right',
    typeLabel: 'FACE + HAND',
    imagePath: '/memes/monkey-surprised.png',
    category: 'combination',
    enabled: true,
    source: 'built-in',
    accentColor: 'orange',
    mockConfidence: 80,
    trigger: {
      type: 'combined',
      conditions: [
        { feature: 'hands', category: 'hand', value: 'hand-on-chest', required: true },
        { feature: 'mouth', category: 'face', value: 'open', required: true },
        { feature: 'gaze', category: 'face', value: 'right', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
]


const LEGACY_STORAGE_KEY = 'meme-vision:memes:v1'

// In-memory mirror of IndexedDB. getAllMemes() must stay synchronous because the
// trigger engine reads it every animation frame; async hydration fills this cache
// and then notifies subscribers so React views re-render.
let customMemes: Meme[] = []
let deletedMemeIds = new Set<string>()
let hydrationPromise: Promise<void> | null = null
const listeners = new Set<() => void>()

function notify(): void {
  listeners.forEach((listener) => listener())
}

export function subscribeMemes(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// One-time migration of any memes saved by the old localStorage implementation.
// Best-effort: obsolete data must never block or crash the app.
async function migrateLegacyStorage(): Promise<void> {
  if (typeof window === 'undefined') return

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
  } catch {
    return
  }
  if (!raw) return

  try {
    const stored = JSON.parse(raw) as { customMemes?: Meme[]; deletedMemeIds?: string[] }
    const legacyCustom = Array.isArray(stored.customMemes) ? stored.customMemes : []
    const legacyDeleted = Array.isArray(stored.deletedMemeIds) ? stored.deletedMemeIds : []

    for (const meme of legacyCustom) {
      if (meme && typeof meme.id === 'string') {
        await storage.putCustomMeme(meme)
      }
    }

    if (legacyDeleted.length) {
      const existing = await storage.loadDeletedIds()
      await storage.saveDeletedIds(Array.from(new Set([...existing, ...legacyDeleted])))
    }

    window.localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Leave the legacy key in place so a future load can retry the migration.
  }
}

export function ensureMemesLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()

  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      await migrateLegacyStorage()
      const [loadedCustom, loadedDeleted] = await Promise.all([
        storage.loadAllCustomMemes(),
        storage.loadDeletedIds(),
      ])
      customMemes = loadedCustom
      deletedMemeIds = new Set(loadedDeleted)
      notify()
    })().catch((error) => {
      // Built-in memes keep working even if local storage is unavailable.
      hydrationPromise = null
      console.warn('[BENKASOT] Custom meme storage unavailable:', error)
    })
  }

  return hydrationPromise
}

// Start loading as soon as this module is imported in the browser so custom
// memes are ready by the time the camera/trigger engine runs.
if (typeof window !== 'undefined') {
  void ensureMemesLoaded()
}

export function getAllMemes(): Meme[] {
  const overriddenIds = new Set(customMemes.map((meme) => meme.id))
  return [
    ...memes.filter((meme) => !overriddenIds.has(meme.id) && !deletedMemeIds.has(meme.id)),
    ...customMemes.filter((meme) => !deletedMemeIds.has(meme.id)),
  ]
}

export async function addCustomMeme(meme: Meme): Promise<void> {
  await ensureMemesLoaded()
  await storage.putCustomMeme(meme)
  customMemes = [...customMemes.filter((item) => item.id !== meme.id), meme]
  deletedMemeIds = new Set([...deletedMemeIds].filter((id) => id !== meme.id))
  notify()
}

export async function deleteMeme(id: string): Promise<void> {
  await ensureMemesLoaded()

  const isCustom = customMemes.some((meme) => meme.id === id)
  if (isCustom) {
    await storage.deleteCustomMeme(id)
    customMemes = customMemes.filter((item) => item.id !== id)
  } else {
    const nextDeleted = new Set(deletedMemeIds).add(id)
    await storage.saveDeletedIds([...nextDeleted])
    deletedMemeIds = nextDeleted
  }

  notify()
}

export function getMemeById(id: string): Meme | undefined {
  return getAllMemes().find((meme) => meme.id === id)
}
