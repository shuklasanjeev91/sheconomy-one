import { createContext, useContext, useMemo, type ReactNode } from 'react'

import type { MeetingRole } from '~/co-work/lib/types'

export type MeetingLiveSignalsValue = {
  localUserId: string
  handRaised: boolean
  raisedHands: Record<string, boolean>
  /** LiveKit identity → meeting role for tile badges. */
  rolesByUserId: Record<string, MeetingRole>
}

const MeetingLiveSignalsContext = createContext<MeetingLiveSignalsValue>({
  localUserId: '',
  handRaised: false,
  raisedHands: {},
  rolesByUserId: {},
})

export function MeetingLiveSignalsProvider({
  localUserId,
  handRaised,
  raisedHands,
  rolesByUserId = {},
  children,
}: MeetingLiveSignalsValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ localUserId, handRaised, raisedHands, rolesByUserId }),
    [handRaised, localUserId, raisedHands, rolesByUserId],
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

/** Host / co-host role for a LiveKit identity, if known. */
export function useParticipantMeetingRole(identity: string | undefined): MeetingRole | null {
  const { rolesByUserId } = useMeetingLiveSignals()
  if (!identity) return null
  return rolesByUserId[identity] ?? null
}
