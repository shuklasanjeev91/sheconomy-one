import { createContext, useContext, useMemo, type ReactNode } from 'react'

export type MeetingLiveSignalsValue = {
  localUserId: string
  handRaised: boolean
  raisedHands: Record<string, boolean>
}

const MeetingLiveSignalsContext = createContext<MeetingLiveSignalsValue>({
  localUserId: '',
  handRaised: false,
  raisedHands: {},
})

export function MeetingLiveSignalsProvider({
  localUserId,
  handRaised,
  raisedHands,
  children,
}: MeetingLiveSignalsValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ localUserId, handRaised, raisedHands }),
    [handRaised, localUserId, raisedHands],
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
