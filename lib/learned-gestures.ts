import type { LearnedGestureProfile } from '@/types/learned-gesture'

let profiles: LearnedGestureProfile[] = []

export function getLearnedGestures(): LearnedGestureProfile[] {
  return [...profiles]
}

export function addLearnedGesture(profile: LearnedGestureProfile): void {
  profiles = [...profiles.filter(item => item.id !== profile.id), profile]
}

export function deleteLearnedGesture(id: string): void {
  profiles = profiles.filter(item => item.id !== id)
}

export function getLearnedGestureById(id: string): LearnedGestureProfile | undefined {
  return profiles.find(item => item.id === id)
}

export function clearLearnedGestures(): void {
  profiles = []
}
