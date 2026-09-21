import type { Meme } from '@/types/meme'

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
        { feature: 'expression', category: 'face', value: 'excited', required: true },
        { feature: 'hands', category: 'hand', value: 'fist', required: true },
        { feature: 'movement', category: 'movement', value: 'celebratory', required: false, enabled: false },
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
        { feature: 'expression', category: 'face', value: 'crying', required: true },
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
        { feature: 'hands', category: 'hand', value: 'both-hands-near-left-chest', required: true },
        { feature: 'mouth', category: 'face', value: 'open', required: true },
        { feature: 'gaze', category: 'face', value: 'right', required: true },
      ],
    },
    overlay: defaultOverlay,
  },
]


let customMemes: Meme[] = []

export function getAllMemes(): Meme[] {
  return [...memes, ...customMemes]
}

export function addCustomMeme(meme: Meme): void {
  customMemes = [...customMemes.filter((item) => item.id !== meme.id), meme]
}

export function deleteCustomMeme(id: string): void {
  customMemes = customMemes.filter((item) => item.id !== id)
}

export function getMemeById(id: string): Meme | undefined {
  return getAllMemes().find((meme) => meme.id === id)
}
