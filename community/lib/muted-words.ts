import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'

import { htmlToPlainText } from '~/community/lib/post-text'

const STORAGE_KEY = 'sheconomy:muted-words'
const MAX_WORDS = 30

let words: string[] = []
let loaded = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

async function ensureLoaded() {
  if (loaded) return
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    words = Array.isArray(parsed)
      ? parsed
          .map((value) => (typeof value === 'string' ? normalizeMutedWord(value) : null))
          .filter((value): value is string => !!value)
          .slice(0, MAX_WORDS)
      : []
  } catch {
    words = []
  }
  loaded = true
  emit()
}

void ensureLoaded()

function persist() {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(words)).catch(() => {})
}

/** A muted word is 2–40 letters or digits, stored lowercase without a leading #. */
export function normalizeMutedWord(raw: string): string | null {
  const word = raw.trim().toLowerCase().replace(/^#/, '')
  if (word.length < 2 || word.length > 40) return null
  if (!/^[\p{L}\p{N}]+$/u.test(word)) return null
  return word
}

function boundaryPattern(word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu')
}

/** True when plain post text contains a muted word as a whole word. */
export function postMatchesMutedWords(content: string | null | undefined, muted: string[]): boolean {
  if (!content || muted.length === 0) return false
  const plain = htmlToPlainText(content)
  return muted.some((word) => boundaryPattern(word).test(plain))
}

export function filterPostsByMutedWords<T extends { content?: string | null }>(
  posts: T[],
  muted: string[],
): T[] {
  if (muted.length === 0) return posts
  return posts.filter((post) => !postMatchesMutedWords(post.content, muted))
}

export function addMutedWord(raw: string): string | null {
  const word = normalizeMutedWord(raw)
  if (!word || words.includes(word)) return word
  words = [word, ...words].slice(0, MAX_WORDS)
  emit()
  persist()
  return word
}

export function removeMutedWord(raw: string) {
  const word = normalizeMutedWord(raw)
  if (!word) return
  const next = words.filter((row) => row !== word)
  if (next.length === words.length) return
  words = next
  emit()
  persist()
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot() {
  return words
}

export function useMutedWords(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
