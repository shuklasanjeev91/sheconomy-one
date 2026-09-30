export type ParticipantAvatarMeta = {
  avatarUrl?: string | null
}

/** Parse participant metadata for a profile image URL. */
export function getParticipantAvatarUrl(participant: {
  metadata?: string | undefined
} | null | undefined): string | null {
  const raw = participant?.metadata
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ParticipantAvatarMeta
    const url = parsed?.avatarUrl
    return typeof url === 'string' && url.trim() ? url.trim() : null
  } catch {
    return null
  }
}

export function buildParticipantMetadata(input: {
  avatarUrl?: string | null
}): string {
  return JSON.stringify({
    avatarUrl: input.avatarUrl?.trim() || null,
  } satisfies ParticipantAvatarMeta)
}

/** True when the camera tile should show an avatar instead of live video. */
export function isCameraTileOff(input: {
  source?: string
  publication?: { isMuted?: boolean; track?: unknown } | null
  isPlaceholder?: boolean
}): boolean {
  if (input.source === 'screen_share') return false
  if (input.isPlaceholder) return true
  const pub = input.publication
  if (!pub) return true
  if (pub.isMuted) return true
  if (!pub.track) return true
  return false
}

export function participantDisplayName(
  participant: { name?: string; identity?: string } | null | undefined,
): string {
  const name = participant?.name?.trim()
  if (name && !/^user_[a-z0-9]+$/i.test(name)) return name
  const identity = participant?.identity?.trim()
  if (!identity || /^user_[a-z0-9]+$/i.test(identity) || /^[0-9a-f-]{32,36}$/i.test(identity)) {
    return 'Guest'
  }
  return identity
}
