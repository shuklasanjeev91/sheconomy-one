import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import type { MeetingNonverbalStatusId } from '~/co-work/lib/meeting-nonverbal'
import {
  MEETING_MAX_PINNED,
  normalizePinnedIdentities,
  togglePinnedIdentity,
} from '~/co-work/lib/meeting-stage-focus'
import type { MeetingRole } from '~/co-work/lib/types'

export type MeetingTileHostActions = {
  canModerate: boolean
  setSpotlight: (userId: string | null) => void
  lowerHandFor: (userId: string) => void
}

export type MeetingLiveSignalsValue = {
  localUserId: string
  handRaised: boolean
  raisedHands: Record<string, boolean>
  nonverbalByUserId: Record<string, MeetingNonverbalStatusId>
  /** Zoom: hide remote camera video (show avatars) to save bandwidth. */
  stopIncomingVideo: boolean
  setStopIncomingVideo: (stopped: boolean) => void
  /** LiveKit identity → meeting role for tile badges. */
  rolesByUserId: Record<string, MeetingRole>
  /**
   * Native bottom sheets are in-tree. Android WebRTC SurfaceViews steal every
   * tap while they are mounted, so tiles hide their VideoTrack while this is set.
   */
  blockVideoSurfaces: boolean
  setExtraSurfaceBlock: (blocked: boolean) => void
  /**
   * Zoom-web side panel width (+ gap) so the stage reflows instead of sitting
   * under Chat/People. Zero on Zoom-mobile sheets.
   */
  stageTrailingInset: number
  setStageTrailingInset: (inset: number) => void
  /** Host spotlight — room-wide focus identity (user id / LiveKit identity). */
  spotlightUserId: string | null
  /** Local multi-pin identities (max 3). */
  pinnedUserIds: string[]
  togglePinnedUserId: (userId: string) => void
  clearPinnedUserIds: () => void
  /** Host tile actions (spotlight / lower hand) — optional until room wires them. */
  tileHostActions: MeetingTileHostActions | null
}

const MeetingLiveSignalsContext = createContext<MeetingLiveSignalsValue>({
  localUserId: '',
  handRaised: false,
  raisedHands: {},
  nonverbalByUserId: {},
  stopIncomingVideo: false,
  setStopIncomingVideo: () => {},
  rolesByUserId: {},
  blockVideoSurfaces: false,
  setExtraSurfaceBlock: () => {},
  stageTrailingInset: 0,
  setStageTrailingInset: () => {},
  spotlightUserId: null,
  pinnedUserIds: [],
  togglePinnedUserId: () => {},
  clearPinnedUserIds: () => {},
  tileHostActions: null,
})

export function MeetingLiveSignalsProvider({
  localUserId,
  handRaised,
  raisedHands,
  nonverbalByUserId = {},
  rolesByUserId = {},
  blockVideoSurfaces = false,
  spotlightUserId = null,
  tileHostActions = null,
  children,
}: {
  localUserId: string
  handRaised: boolean
  raisedHands: Record<string, boolean>
  nonverbalByUserId?: Record<string, MeetingNonverbalStatusId>
  rolesByUserId?: Record<string, MeetingRole>
  blockVideoSurfaces?: boolean
  spotlightUserId?: string | null
  tileHostActions?: MeetingTileHostActions | null
  children: ReactNode
}) {
  const [extraSurfaceBlock, setExtraSurfaceBlock] = useState(false)
  const [stopIncomingVideo, setStopIncomingVideo] = useState(false)
  const [stageTrailingInset, setStageTrailingInset] = useState(0)
  const [pinnedUserIds, setPinnedUserIds] = useState<string[]>([])
  const setExtraSurfaceBlockStable = useCallback((blocked: boolean) => {
    setExtraSurfaceBlock(blocked)
  }, [])
  const setStageTrailingInsetStable = useCallback((inset: number) => {
    setStageTrailingInset(Math.max(0, Math.round(inset)))
  }, [])
  const togglePinnedUserId = useCallback((userId: string) => {
    setPinnedUserIds((current) => togglePinnedIdentity(current, userId, MEETING_MAX_PINNED))
  }, [])
  const clearPinnedUserIds = useCallback(() => {
    setPinnedUserIds([])
  }, [])
  const value = useMemo(
    () => ({
      localUserId,
      handRaised,
      raisedHands,
      nonverbalByUserId,
      stopIncomingVideo,
      setStopIncomingVideo,
      rolesByUserId,
      blockVideoSurfaces: blockVideoSurfaces || extraSurfaceBlock,
      setExtraSurfaceBlock: setExtraSurfaceBlockStable,
      stageTrailingInset,
      setStageTrailingInset: setStageTrailingInsetStable,
      spotlightUserId,
      pinnedUserIds: normalizePinnedIdentities(pinnedUserIds),
      togglePinnedUserId,
      clearPinnedUserIds,
      tileHostActions,
    }),
    [
      blockVideoSurfaces,
      clearPinnedUserIds,
      extraSurfaceBlock,
      handRaised,
      localUserId,
      nonverbalByUserId,
      pinnedUserIds,
      raisedHands,
      rolesByUserId,
      setExtraSurfaceBlockStable,
      setStageTrailingInsetStable,
      setStopIncomingVideo,
      spotlightUserId,
      stageTrailingInset,
      stopIncomingVideo,
      tileHostActions,
      togglePinnedUserId,
    ],
  )
  return (
    <MeetingLiveSignalsContext.Provider value={value}>{children}</MeetingLiveSignalsContext.Provider>
  )
}

export function useMeetingLiveSignals() {
  return useContext(MeetingLiveSignalsContext)
}

/** Whether this LiveKit identity currently has a raised hand. */
export function useParticipantHandRaised(identity: string | undefined): boolean {
  const { localUserId, handRaised, raisedHands } = useMeetingLiveSignals()
  if (!identity) return false
  if (identity === localUserId) return handRaised
  return !!raisedHands[identity]
}

/** Sticky nonverbal feedback for a LiveKit identity. */
export function useParticipantNonverbal(
  identity: string | undefined,
): MeetingNonverbalStatusId | null {
  const { nonverbalByUserId } = useMeetingLiveSignals()
  if (!identity) return null
  return nonverbalByUserId[identity] ?? null
}

/** Host / co-host role for a LiveKit identity, if known. */
export function useParticipantMeetingRole(identity: string | undefined): MeetingRole | null {
  const { rolesByUserId } = useMeetingLiveSignals()
  if (!identity) return null
  return rolesByUserId[identity] ?? null
}
