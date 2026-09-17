import { useEffect, useMemo, useRef, useState } from 'react'
import { RoomEvent, type Participant, type Room } from 'livekit-client'

import {
  identitiesFromActiveSpeakers,
  resolveActiveSpeakerIdentity,
  type ActiveSpeakerCandidate,
} from '~/co-work/lib/meeting-active-speaker'

type TrackLike = {
  participant: {
    identity: string
    audioLevel: number
    isSpeaking: boolean
  }
}

/**
 * Sticky active-speaker identity for Speaker view.
 * Prefers LiveKit ActiveSpeakersChanged, falls back to per-track audio levels.
 */
export function useMeetingActiveSpeaker(input: {
  room?: Room | null
  tracks: TrackLike[]
  enabled?: boolean
}): string | null {
  const enabled = input.enabled !== false
  const [activeIdentity, setActiveIdentity] = useState<string | null>(null)
  const previousRef = useRef<string | null>(null)

  const candidates = useMemo<ActiveSpeakerCandidate[]>(() => {
    const byIdentity = new Map<string, ActiveSpeakerCandidate>()
    for (const track of input.tracks) {
      const identity = track.participant.identity
      if (!identity) continue
      const existing = byIdentity.get(identity)
      const next: ActiveSpeakerCandidate = {
        identity,
        audioLevel: track.participant.audioLevel ?? 0,
        isSpeaking: !!track.participant.isSpeaking,
      }
      if (!existing || next.audioLevel > existing.audioLevel) {
        byIdentity.set(identity, next)
      }
    }
    return [...byIdentity.values()]
  }, [input.tracks])

  useEffect(() => {
    if (!enabled) {
      previousRef.current = null
      setActiveIdentity(null)
      return
    }

    const apply = (eventIdentities: string[] = []) => {
      const boosted = candidates.map((candidate) => {
        const rank = eventIdentities.indexOf(candidate.identity)
        return {
          ...candidate,
          isSpeaking: candidate.isSpeaking || rank >= 0,
          audioLevel:
            rank === 0
              ? Math.max(candidate.audioLevel, 0.55)
              : rank > 0
                ? Math.max(candidate.audioLevel, 0.3 - rank * 0.05)
                : candidate.audioLevel,
        }
      })
      const next = resolveActiveSpeakerIdentity({
        candidates: boosted,
        previousIdentity: previousRef.current,
      })
      if (next !== previousRef.current) {
        previousRef.current = next
        setActiveIdentity(next)
      } else if (previousRef.current == null && next) {
        previousRef.current = next
        setActiveIdentity(next)
      }
    }

    apply()

    const room = input.room
    if (!room) return

    const onActiveSpeakers = (speakers: Participant[]) => {
      apply(identitiesFromActiveSpeakers(speakers))
    }
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
    onActiveSpeakers(room.activeSpeakers ?? [])
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
    }
  }, [candidates, enabled, input.room])

  return enabled ? activeIdentity : null
}
