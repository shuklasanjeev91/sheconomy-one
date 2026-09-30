/**
 * mediasoup peer ids are `{userId}~{session}` so one account can be in a
 * meeting from two devices without the server closing the older peer (which
 * would rejoin and close the newer one, forever). Tiles key by user id.
 */
export const MEDIASOUP_PEER_SEPARATOR = '~'

export function mediasoupPeerId(userId: string, session: string): string {
  return `${userId}${MEDIASOUP_PEER_SEPARATOR}${session}`
}

export function mediasoupPeerUserId(peerId: string): string {
  const index = peerId.indexOf(MEDIASOUP_PEER_SEPARATOR)
  return index === -1 ? peerId : peerId.slice(0, index)
}

export function randomMediasoupSession(): string {
  return Math.random().toString(36).slice(2, 10)
}
