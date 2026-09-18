/**
 * Centralized Co-Work meeting lifecycle state machine.
 *
 * All meeting lifecycle transitions must go through `meetingStateReducer` /
 * `resolveMeetingLifecycleAction`. Screens and media hooks supply signals;
 * they must not invent ad-hoc lifecycle strings or bypass this module.
 */

export type MeetingLifecycleState =
  | 'LOBBY'
  | 'WAITING_FOR_HOST'
  | 'JOINING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'CONNECTED_WITH_AUDIO_ONLY'
  | 'SCREEN_SHARING'
  | 'LEAVING'
  | 'ENDED'
  | 'REMOVED'
  | 'LOCKED'

export type MeetingConnectedState = Extract<
  MeetingLifecycleState,
  'CONNECTED' | 'CONNECTED_WITH_AUDIO_ONLY'
>

export type MeetingViewMode = 'gallery' | 'speaker' | 'screen-share'

export type MeetingUiMode = 'normal' | 'maximized'

export type MeetingMachineState = {
  lifecycle: MeetingLifecycleState
  /** Last non-share connected mode — restored when screen share stops. */
  previousConnectedState: MeetingConnectedState
  viewMode: MeetingViewMode
  uiMode: MeetingUiMode
  mirrorLocalVideo: boolean
  /** Zoom-style: hide the local camera tile from gallery / filmstrip. */
  hideSelfView: boolean
  /** Wide desktop: 7×7 dense gallery pages (49 tiles). */
  denseGallery: boolean
  controlsVisible: boolean
  /** When true, idle auto-hide is disabled until the host unpins. */
  controlsPinned: boolean
  participantStripMinimized: boolean
  error: string | null
}

export type MeetingMachineAction =
  | { type: 'LOBBY' }
  | { type: 'WAIT_FOR_HOST' }
  | { type: 'JOIN' }
  | { type: 'CONNECTED'; audioOnly?: boolean }
  | { type: 'RECONNECT' }
  | { type: 'SHARE_STARTED' }
  | { type: 'SHARE_STOPPED' }
  | { type: 'LEAVE' }
  | { type: 'ENDED' }
  | { type: 'REMOVED' }
  | { type: 'LOCKED' }
  | { type: 'SET_VIEW'; viewMode: MeetingViewMode }
  | { type: 'SET_UI_MODE'; uiMode: MeetingUiMode }
  | { type: 'TOGGLE_UI_MODE' }
  | { type: 'SET_MIRROR_LOCAL_VIDEO'; enabled: boolean }
  | { type: 'SET_HIDE_SELF_VIEW'; enabled: boolean }
  | { type: 'SET_DENSE_GALLERY'; enabled: boolean }
  | { type: 'SET_CONTROLS'; visible: boolean }
  | { type: 'SET_CONTROLS_PINNED'; pinned: boolean }
  | { type: 'TOGGLE_PARTICIPANT_STRIP' }
  | { type: 'ERROR'; message: string | null }

/**
 * Presence / media / exit signals fed into the centralized resolver.
 * Components report facts; they do not pick lifecycle labels themselves.
 */
export type MeetingLifecycleSignals = {
  /** Pre-join lobby (confirm identity / devices). */
  inLobby?: boolean
  /** Meeting locked for this viewer (non-host). */
  locked?: boolean
  waitingForHost?: boolean
  joining?: boolean
  removed?: boolean
  /** Host ended the meeting for everyone, or local leave finished navigating away. */
  ended?: boolean
  /** Local leave / end teardown in progress. */
  leaving?: boolean
  connectionFailed?: boolean
  mediaReconnecting?: boolean
  /** LiveKit (or equivalent) is in the room. */
  inMeeting?: boolean
  screenSharing?: boolean
  audioOnly?: boolean
}

/** Terminal states — only intentional leave/end/remove/lock overrides apply. */
export const MEETING_TERMINAL_STATES: ReadonlySet<MeetingLifecycleState> = new Set([
  'ENDED',
  'REMOVED',
  'LEAVING',
])

export const MEETING_LIFECYCLE_STATES: readonly MeetingLifecycleState[] = [
  'LOBBY',
  'WAITING_FOR_HOST',
  'JOINING',
  'CONNECTED',
  'RECONNECTING',
  'CONNECTED_WITH_AUDIO_ONLY',
  'SCREEN_SHARING',
  'LEAVING',
  'ENDED',
  'REMOVED',
  'LOCKED',
] as const

export const initialMeetingMachineState: MeetingMachineState = {
  lifecycle: 'LOBBY',
  previousConnectedState: 'CONNECTED',
  viewMode: 'gallery',
  uiMode: 'normal',
  mirrorLocalVideo: true,
  hideSelfView: false,
  denseGallery: false,
  controlsVisible: true,
  controlsPinned: false,
  participantStripMinimized: false,
  error: null,
}

function isLifecycleAction(
  action: MeetingMachineAction,
): action is Extract<
  MeetingMachineAction,
  | { type: 'LOBBY' }
  | { type: 'WAIT_FOR_HOST' }
  | { type: 'JOIN' }
  | { type: 'CONNECTED'; audioOnly?: boolean }
  | { type: 'RECONNECT' }
  | { type: 'SHARE_STARTED' }
  | { type: 'SHARE_STOPPED' }
  | { type: 'LEAVE' }
  | { type: 'ENDED' }
  | { type: 'REMOVED' }
  | { type: 'LOCKED' }
> {
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
      return true
    default:
      return false
  }
}

function targetLifecycle(
  action: Extract<MeetingMachineAction, { type: string }>,
  state: MeetingMachineState,
): MeetingLifecycleState | null {
  switch (action.type) {
    case 'LOBBY':
      return 'LOBBY'
    case 'WAIT_FOR_HOST':
      return 'WAITING_FOR_HOST'
    case 'JOIN':
      return 'JOINING'
    case 'CONNECTED':
      return (action as { audioOnly?: boolean }).audioOnly
        ? 'CONNECTED_WITH_AUDIO_ONLY'
        : 'CONNECTED'
    case 'RECONNECT':
      return 'RECONNECTING'
    case 'SHARE_STARTED':
      return 'SCREEN_SHARING'
    case 'SHARE_STOPPED':
      return state.previousConnectedState
    case 'LEAVE':
      return 'LEAVING'
    case 'ENDED':
      return 'ENDED'
    case 'REMOVED':
      return 'REMOVED'
    case 'LOCKED':
      return 'LOCKED'
    default:
      return null
  }
}

/**
 * Whether a lifecycle transition is allowed.
 * UI preference actions (SET_VIEW, etc.) always apply outside this check.
 */
export function canTransitionMeetingLifecycle(
  from: MeetingLifecycleState,
  to: MeetingLifecycleState,
  via?: MeetingMachineAction['type'],
): boolean {
  if (from === to) return true
  if (MEETING_TERMINAL_STATES.has(from)) {
    // Allow leave → ended, and recovering from leaving only via ended/removed.
    if (from === 'LEAVING' && (to === 'ENDED' || to === 'REMOVED' || to === 'LOBBY')) return true
    return false
  }
  // CONNECTED must not clobber an active screen share — use SHARE_STOPPED first.
  if (from === 'SCREEN_SHARING' && (to === 'CONNECTED' || to === 'CONNECTED_WITH_AUDIO_ONLY')) {
    return via === 'SHARE_STOPPED'
  }
  return true
}

export function meetingLifecycleLabel(lifecycle: MeetingLifecycleState): string {
  switch (lifecycle) {
    case 'LOBBY':
      return 'Lobby'
    case 'WAITING_FOR_HOST':
      return 'Waiting for host'
    case 'JOINING':
      return 'Joining'
    case 'CONNECTED':
      return 'Connected'
    case 'RECONNECTING':
      return 'Reconnecting'
    case 'CONNECTED_WITH_AUDIO_ONLY':
      return 'Connected (audio only)'
    case 'SCREEN_SHARING':
      return 'Screen sharing'
    case 'LEAVING':
      return 'Leaving'
    case 'ENDED':
      return 'Ended'
    case 'REMOVED':
      return 'Removed'
    case 'LOCKED':
      return 'Locked'
  }
}

/**
 * Map presence/media/exit facts to at most one lifecycle action.
 * Priority is explicit so components never race each other.
 */
export function resolveMeetingLifecycleAction(
  current: MeetingLifecycleState,
  signals: MeetingLifecycleSignals,
): MeetingMachineAction | null {
  if (signals.ended) {
    return current === 'ENDED' ? null : { type: 'ENDED' }
  }
  if (signals.removed) {
    return current === 'REMOVED' ? null : { type: 'REMOVED' }
  }
  if (signals.leaving) {
    return current === 'LEAVING' ? null : { type: 'LEAVE' }
  }
  if (signals.locked) {
    return current === 'LOCKED' ? null : { type: 'LOCKED' }
  }

  // Terminal: ignore soft presence updates until an intentional exit above.
  if (MEETING_TERMINAL_STATES.has(current)) {
    return null
  }

  if (current === 'LOCKED') {
    if (signals.locked) return null
    // Host unlocked / viewer re-checked — return to lobby for this session.
    if (signals.inLobby) return { type: 'LOBBY' }
    if (signals.joining) return { type: 'JOIN' }
    return null
  }

  if (signals.waitingForHost) {
    return current === 'WAITING_FOR_HOST' ? null : { type: 'WAIT_FOR_HOST' }
  }
  if (signals.joining) {
    return current === 'JOINING' ? null : { type: 'JOIN' }
  }
  if (signals.inLobby) {
    return current === 'LOBBY' ? null : { type: 'LOBBY' }
  }

  if (signals.connectionFailed || signals.mediaReconnecting) {
    return current === 'RECONNECTING' ? null : { type: 'RECONNECT' }
  }

  if (signals.inMeeting) {
    if (signals.screenSharing === true) {
      return current === 'SCREEN_SHARING' ? null : { type: 'SHARE_STARTED' }
    }
    if (signals.screenSharing === false && current === 'SCREEN_SHARING') {
      return { type: 'SHARE_STOPPED' }
    }
    // Presence admits the viewer before LiveKit reports share state — do not
    // clear SCREEN_SHARING unless screenSharing was explicitly false.
    if (current === 'SCREEN_SHARING' && signals.screenSharing === undefined) {
      return null
    }
    const audioOnly = !!signals.audioOnly
    const desired: MeetingLifecycleState = audioOnly
      ? 'CONNECTED_WITH_AUDIO_ONLY'
      : 'CONNECTED'
    if (current === desired) return null
    return { type: 'CONNECTED', audioOnly }
  }

  return null
}

function rememberConnectedState(
  state: MeetingMachineState,
  next: MeetingConnectedState,
): MeetingConnectedState {
  return next
}

export function meetingStateReducer(
  state: MeetingMachineState,
  action: MeetingMachineAction,
): MeetingMachineState {
  if (isLifecycleAction(action)) {
    const next = targetLifecycle(action, state)
    if (next && !canTransitionMeetingLifecycle(state.lifecycle, next, action.type)) {
      return state
    }
  }

  switch (action.type) {
    case 'LOBBY':
      if (state.lifecycle === 'LOBBY' && state.error === null) return state
      return { ...state, lifecycle: 'LOBBY', error: null }
    case 'WAIT_FOR_HOST':
      if (state.lifecycle === 'WAITING_FOR_HOST' && state.error === null) return state
      return { ...state, lifecycle: 'WAITING_FOR_HOST', error: null }
    case 'JOIN':
      if (state.lifecycle === 'JOINING' && state.error === null) return state
      return { ...state, lifecycle: 'JOINING', error: null }
    case 'CONNECTED': {
      const lifecycle: MeetingConnectedState = action.audioOnly
        ? 'CONNECTED_WITH_AUDIO_ONLY'
        : 'CONNECTED'
      return {
        ...state,
        lifecycle,
        previousConnectedState: rememberConnectedState(state, lifecycle),
        error: null,
      }
    }
    case 'RECONNECT':
      return { ...state, lifecycle: 'RECONNECTING' }
    case 'SHARE_STARTED': {
      const previousConnectedState: MeetingConnectedState =
        state.lifecycle === 'CONNECTED_WITH_AUDIO_ONLY' ||
        state.previousConnectedState === 'CONNECTED_WITH_AUDIO_ONLY'
          ? 'CONNECTED_WITH_AUDIO_ONLY'
          : 'CONNECTED'
      return {
        ...state,
        lifecycle: 'SCREEN_SHARING',
        previousConnectedState,
        // Only auto-focus screen share on the rising edge. Re-dispatching while
        // already sharing must not yank the user out of Gallery / Speaker.
        viewMode: state.lifecycle === 'SCREEN_SHARING' ? state.viewMode : 'screen-share',
        uiMode: state.lifecycle === 'SCREEN_SHARING' ? state.uiMode : 'maximized',
        controlsVisible: true,
        participantStripMinimized:
          state.lifecycle === 'SCREEN_SHARING' ? state.participantStripMinimized : true,
      }
    }
    case 'SHARE_STOPPED':
      return {
        ...state,
        lifecycle: state.previousConnectedState,
        viewMode: state.viewMode === 'screen-share' ? 'gallery' : state.viewMode,
        uiMode: 'normal',
        controlsVisible: true,
        participantStripMinimized: false,
      }
    case 'LEAVE':
      return { ...state, lifecycle: 'LEAVING', controlsVisible: true }
    case 'ENDED':
      return { ...state, lifecycle: 'ENDED', controlsVisible: true }
    case 'REMOVED':
      return { ...state, lifecycle: 'REMOVED', controlsVisible: true }
    case 'LOCKED':
      return { ...state, lifecycle: 'LOCKED', controlsVisible: true }
    case 'SET_VIEW':
      return {
        ...state,
        viewMode: action.viewMode,
        // Speaker / screen-share need the filmstrip unless the stage is maximized.
        participantStripMinimized:
          action.viewMode === 'gallery'
            ? state.participantStripMinimized
            : state.uiMode === 'maximized'
              ? true
              : false,
        uiMode:
          action.viewMode === 'screen-share' && state.uiMode === 'normal'
            ? 'maximized'
            : state.uiMode,
      }
    case 'SET_UI_MODE':
      return {
        ...state,
        uiMode: action.uiMode,
        controlsVisible: true,
        participantStripMinimized:
          action.uiMode === 'maximized' ? true : state.participantStripMinimized,
      }
    case 'TOGGLE_UI_MODE':
      return meetingStateReducer(state, {
        type: 'SET_UI_MODE',
        uiMode: state.uiMode === 'maximized' ? 'normal' : 'maximized',
      })
    case 'SET_MIRROR_LOCAL_VIDEO':
      if (state.mirrorLocalVideo === action.enabled) return state
      return { ...state, mirrorLocalVideo: action.enabled }
    case 'SET_HIDE_SELF_VIEW':
      if (state.hideSelfView === action.enabled) return state
      return { ...state, hideSelfView: action.enabled }
    case 'SET_DENSE_GALLERY':
      if (state.denseGallery === action.enabled) return state
      return { ...state, denseGallery: action.enabled }
    case 'SET_CONTROLS':
      if (state.controlsVisible === action.visible) return state
      return { ...state, controlsVisible: action.visible }
    case 'SET_CONTROLS_PINNED':
      return {
        ...state,
        controlsPinned: action.pinned,
        controlsVisible: action.pinned ? true : state.controlsVisible,
      }
    case 'TOGGLE_PARTICIPANT_STRIP':
      return { ...state, participantStripMinimized: !state.participantStripMinimized }
    case 'ERROR':
      return { ...state, error: action.message }
  }
}
