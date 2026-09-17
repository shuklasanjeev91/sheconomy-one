import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import {
  initialMeetingMachineState,
  meetingStateReducer,
  type MeetingMachineAction,
  type MeetingMachineState,
} from '~/co-work/lib/meeting-state-machine'
import {
  meetingFeatureFlags,
  type MeetingFeatureFlags,
} from '~/co-work/lib/meeting-feature-flags'
import {
  composeMeetingRealtimeSession,
  createLiveKitMeetingMediaAdapter,
  createPresenceCollaborationAdapter,
  type MeetingCollaborationAdapter,
  type MeetingMediaAdapter,
  type MeetingPresenceCollaborationSource,
  type MeetingRealtimeSession,
} from '~/co-work/lib/realtime'
import type { LiveKitMediaControls } from '~/co-work/lib/livekit-media-controls'

/** @deprecated Import from `~/co-work/lib/realtime` — kept for existing imports. */
export type { MeetingMediaAdapter, MeetingCollaborationAdapter }

type MeetingContextValue = {
  state: MeetingMachineState
  dispatch: Dispatch<MeetingMachineAction>
  features: MeetingFeatureFlags
  /** Spec #31 session surface — media + collaboration, SFU-backed. */
  session: MeetingRealtimeSession
  registerMediaAdapter: (adapter: MeetingMediaAdapter | null) => void
  registerCollaborationAdapter: (adapter: MeetingCollaborationAdapter | null) => void
  /** Bind LiveKit SFU controls as the media layer (replaceable). */
  bindLiveKitMedia: (liveKit: LiveKitMediaControls | null) => void
  /** Bind presence/chat/hands as the collaboration layer. */
  bindPresenceCollaboration: (source: MeetingPresenceCollaborationSource | null) => void
}

const MeetingContext = createContext<MeetingContextValue | null>(null)
const MIRROR_LOCAL_VIDEO_KEY = 'sheconomy.meeting.mirror-local-video.v1'

/**
 * Owns meeting state machine + replaceable realtime session adapters.
 * Media = LiveKit SFU; presence/chat stay on Supabase — never a P2P mesh.
 */
export function MeetingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(meetingStateReducer, initialMeetingMachineState)
  const [adapterEpoch, bumpAdapters] = useReducer((n: number) => n + 1, 0)
  const mirrorPreferenceLoaded = useRef(false)
  const liveKitRef = useRef<LiveKitMediaControls | null>(null)
  const presenceRef = useRef<MeetingPresenceCollaborationSource | null>(null)
  const mediaBoundRef = useRef(false)
  const collabBoundRef = useRef(false)
  const customMediaRef = useRef<MeetingMediaAdapter | null>(null)
  const customCollabRef = useRef<MeetingCollaborationAdapter | null>(null)

  const defaultMediaAdapter = useMemo(
    () =>
      createLiveKitMeetingMediaAdapter(() => liveKitRef.current, {
        platform: Platform.OS === 'web' ? 'web' : 'native',
      }),
    [],
  )
  const defaultCollabAdapter = useMemo(
    () => createPresenceCollaborationAdapter(() => presenceRef.current),
    [],
  )

  useEffect(() => {
    let cancelled = false
    void AsyncStorage.getItem(MIRROR_LOCAL_VIDEO_KEY)
      .then((stored) => {
        if (!cancelled && (stored === '1' || stored === '0')) {
          dispatch({ type: 'SET_MIRROR_LOCAL_VIDEO', enabled: stored === '1' })
        }
      })
      .finally(() => {
        if (!cancelled) mirrorPreferenceLoaded.current = true
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mirrorPreferenceLoaded.current) return
    void AsyncStorage.setItem(MIRROR_LOCAL_VIDEO_KEY, state.mirrorLocalVideo ? '1' : '0').catch(
      () => {},
    )
  }, [state.mirrorLocalVideo])

  const registerMediaAdapter = useCallback((adapter: MeetingMediaAdapter | null) => {
    customMediaRef.current = adapter
    mediaBoundRef.current = !!adapter
    bumpAdapters()
  }, [])

  const registerCollaborationAdapter = useCallback((adapter: MeetingCollaborationAdapter | null) => {
    customCollabRef.current = adapter
    collabBoundRef.current = !!adapter
    bumpAdapters()
  }, [])

  const bindLiveKitMedia = useCallback((liveKit: LiveKitMediaControls | null) => {
    liveKitRef.current = liveKit
    customMediaRef.current = null
    const nextBound = !!liveKit
    if (mediaBoundRef.current === nextBound) return
    mediaBoundRef.current = nextBound
    bumpAdapters()
  }, [])

  const bindPresenceCollaboration = useCallback(
    (source: MeetingPresenceCollaborationSource | null) => {
      presenceRef.current = source
      customCollabRef.current = null
      const nextBound = !!source
      if (collabBoundRef.current === nextBound) return
      collabBoundRef.current = nextBound
      bumpAdapters()
    },
    [],
  )

  const session = useMemo(() => {
    const media = mediaBoundRef.current
      ? (customMediaRef.current ?? defaultMediaAdapter)
      : null
    const collaboration = collabBoundRef.current
      ? (customCollabRef.current ?? defaultCollabAdapter)
      : null
    return composeMeetingRealtimeSession({ media, collaboration })
  }, [adapterEpoch, defaultCollabAdapter, defaultMediaAdapter])

  const value = useMemo(
    () => ({
      state,
      dispatch,
      features: meetingFeatureFlags,
      session,
      registerMediaAdapter,
      registerCollaborationAdapter,
      bindLiveKitMedia,
      bindPresenceCollaboration,
    }),
    [
      state,
      session,
      registerMediaAdapter,
      registerCollaborationAdapter,
      bindLiveKitMedia,
      bindPresenceCollaboration,
    ],
  )

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>
}

export function useMeetingMachine(): MeetingContextValue {
  const value = useContext(MeetingContext)
  if (!value) throw new Error('useMeetingMachine must be used inside MeetingProvider')
  return value
}

/** Spec #31 — prefer this for mic/camera/share/chat/hands when possible. */
export function useMeetingRealtimeSession(): MeetingRealtimeSession {
  return useMeetingMachine().session
}

/** Optional lookup so nested screens can avoid double-wrapping the provider. */
export function useOptionalMeetingMachine(): MeetingContextValue | null {
  return useContext(MeetingContext)
}
