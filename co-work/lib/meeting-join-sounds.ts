import { Platform } from 'react-native'

/**
 * Soft join/leave chimes (Zoom "play sound when someone joins/leaves").
 * Web uses Web Audio; native is best-effort via a short oscillator when available.
 */

let lastPlayedAt = 0
const MIN_GAP_MS = 400

function canPlay(): boolean {
  const now = Date.now()
  if (now - lastPlayedAt < MIN_GAP_MS) return false
  lastPlayedAt = now
  return true
}

function playTone(frequency: number, durationMs: number, volume = 0.08) {
  if (Platform.OS !== 'web') return
  try {
    const AudioCtx =
      (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ||
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.value = volume
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
    osc.start(now)
    osc.stop(now + durationMs / 1000 + 0.02)
    void ctx.resume().catch(() => {})
    setTimeout(() => {
      void ctx.close().catch(() => {})
    }, durationMs + 80)
  } catch {
    // Autoplay / AudioContext unavailable — silent.
  }
}

export function playMeetingJoinChime(): void {
  if (!canPlay()) return
  playTone(880, 90, 0.07)
  setTimeout(() => playTone(1174, 110, 0.06), 90)
}

export function playMeetingLeaveChime(): void {
  if (!canPlay()) return
  playTone(660, 100, 0.06)
  setTimeout(() => playTone(440, 120, 0.05), 100)
}

export type MeetingPresenceSoundDelta = {
  previousCount: number
  nextCount: number
  /** First observation after join — skip chime so local join is quiet. */
  isInitial?: boolean
}

/** Decide whether to play join vs leave based on admitted participant count. */
export function resolveMeetingPresenceSound(
  input: MeetingPresenceSoundDelta,
): 'join' | 'leave' | null {
  if (input.isInitial) return null
  if (input.nextCount > input.previousCount) return 'join'
  if (input.nextCount < input.previousCount) return 'leave'
  return null
}
