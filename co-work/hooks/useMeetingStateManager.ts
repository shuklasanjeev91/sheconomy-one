import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useMeetingMachine } from '~/co-work/components/MeetingProvider'
import {
  resolveMeetingLifecycleAction,
  type MeetingLifecycleSignals,
  type MeetingMachineAction,
  type MeetingMachineState,
} from '~/co-work/lib/meeting-state-machine'
import type { MeetingFeatureFlags } from '~/co-work/lib/meeting-feature-flags'

export type MeetingStateManager = {
  state: MeetingMachineState
  features: MeetingFeatureFlags
  /** UI / preference actions only — lifecycle must use sync or leave/end helpers. */
  dispatchUi: (action: MeetingMachineAction) => void
  /**
   * Feed presence/media/exit facts. The manager resolves the single next
   * lifecycle action so screens never pick LOBBY / CONNECTED / etc. themselves.
   */
  syncLifecycle: (signals: MeetingLifecycleSignals) => void
  leave: () => void
  end: () => void
  markRemoved: () => void
  markLocked: () => void
}

/**
 * Centralized meeting state manager for web + native.
 * Prefer this over raw `dispatch({ type: 'CONNECTED' })` from screens.
 */
export function useMeetingStateManager(): MeetingStateManager {
  const { state, dispatch, features } = useMeetingMachine()
  const lifecycleRef = useRef(state.lifecycle)
  lifecycleRef.current = state.lifecycle

  const syncLifecycle = useCallback(
    (signals: MeetingLifecycleSignals) => {
      const action = resolveMeetingLifecycleAction(lifecycleRef.current, signals)
      if (action) dispatch(action)
    },
    [dispatch],
  )

  const dispatchUi = useCallback(
    (action: MeetingMachineAction) => {
      switch (action.type) {
        case 'LOBBY':
        case 'WAIT_FOR_HOST':
        case 'JOIN':
        case 'CONNECTED':
        case 'RECONNECT':
        case 'SHARE_STARTED':
        case 'SHARE_STOPPED':
        case 'LEAVE':
        case 'ENDED':
        case 'REMOVED':
        case 'LOCKED':
          // Lifecycle must go through syncLifecycle / leave / end helpers.
          syncLifecycle(signalsFromLifecycleAction(action))
          return
        default:
          dispatch(action)
      }
    },
    [dispatch, syncLifecycle],
  )

  const leave = useCallback(() => {
    syncLifecycle({ leaving: true })
  }, [syncLifecycle])

  const end = useCallback(() => {
    syncLifecycle({ ended: true })
  }, [syncLifecycle])

  const markRemoved = useCallback(() => {
    syncLifecycle({ removed: true })
  }, [syncLifecycle])

  const markLocked = useCallback(() => {
    syncLifecycle({ locked: true })
  }, [syncLifecycle])

  return useMemo(
    () => ({
      state,
      features,
      dispatchUi,
      syncLifecycle,
      leave,
      end,
      markRemoved,
      markLocked,
    }),
    [state, features, dispatchUi, syncLifecycle, leave, end, markRemoved, markLocked],
  )
}

function signalsFromLifecycleAction(
  action: MeetingMachineAction,
): MeetingLifecycleSignals {
  switch (action.type) {
    case 'LOBBY':
      return { inLobby: true }
    case 'WAIT_FOR_HOST':
      return { waitingForHost: true }
    case 'JOIN':
      return { joining: true }
    case 'CONNECTED':
      return {
        inMeeting: true,
        audioOnly: !!(action as { audioOnly?: boolean }).audioOnly,
        screenSharing: false,
      }
    case 'RECONNECT':
      return { mediaReconnecting: true }
    case 'SHARE_STARTED':
      return { inMeeting: true, screenSharing: true }
    case 'SHARE_STOPPED':
      return { inMeeting: true, screenSharing: false }
    case 'LEAVE':
      return { leaving: true }
    case 'ENDED':
      return { ended: true }
    case 'REMOVED':
      return { removed: true }
    case 'LOCKED':
      return { locked: true }
    default:
      return {}
  }
}

/**
 * Keep the machine in sync with presence/media signals.
 * Only re-runs when the signal bitmap changes — never on lifecycle itself
 * (that caused JOIN ↔ CONNECTED update loops / auto-disconnect).
 */
export function useSyncMeetingLifecycle(signals: MeetingLifecycleSignals) {
  const { syncLifecycle } = useMeetingStateManager()
  const serialized = serializeSignals(signals)
  const signalsRef = useRef(signals)
  signalsRef.current = signals

  useEffect(() => {
    syncLifecycle(signalsRef.current)
  }, [serialized, syncLifecycle])
}

function serializeSignals(signals: MeetingLifecycleSignals): string {
  return [
    signals.inLobby ? '1' : '0',
    signals.locked ? '1' : '0',
    signals.waitingForHost ? '1' : '0',
    signals.joining ? '1' : '0',
    signals.removed ? '1' : '0',
    signals.ended ? '1' : '0',
    signals.leaving ? '1' : '0',
    signals.connectionFailed ? '1' : '0',
    signals.mediaReconnecting ? '1' : '0',
    signals.inMeeting ? '1' : '0',
    signals.screenSharing ? '1' : '0',
    signals.audioOnly ? '1' : '0',
  ].join('')
}
