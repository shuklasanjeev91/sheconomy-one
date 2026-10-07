import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { useRouter } from 'one'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { ensureGuestUserSession } from '~/co-work/lib/guest-session'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection, ScreenCenter } from '~/components/layout'
import { BRAND_MEMBER_LABEL } from '~/config/brand'
import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import { MeetingCalendarIconButton } from '~/co-work/components/MeetingCalendarIconButton'
import { MeetingAudioTestModal } from '~/co-work/components/MeetingAudioTestModal'
import { MeetingOpenInApp } from '~/co-work/components/MeetingOpenInApp'
import {
  Avatar,
  Button,
  Checkbox,
  Field,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
import { MeetingInvitePanel } from '~/co-work/components/MeetingInvitePanel'
import { MeetingProvider } from '~/co-work/components/MeetingProvider'
import { useSyncMeetingLifecycle } from '~/co-work/hooks/useMeetingStateManager'
import {
  fetchMeetingByCode,
  fetchMeetingModerationSettings,
  formatMeetingCode,
  isMeetingJoinable,
  isWaitingForScheduledStart,
  canEnterLiveMeeting,
  verifyMeetingPasscode,
} from '~/co-work/lib/meetings'
import {
  MEETING_LOCKED_MESSAGE,
  shouldPromptForPasscode,
} from '~/co-work/lib/meeting-security'
import {
  openInstantMeetingSession,
  peekInstantMeetingSession,
  instantMeetingCodesMatch,
} from '~/co-work/lib/instant-meeting-session'
import {
  ensureMeetingMobilePermissions,
  meetingJoinMediaFromPermissions,
} from '~/co-work/lib/meeting-media-permissions'
import { loadMeetingJoinPrefs } from '~/co-work/lib/meeting-join-prefs'
import {
  loadRememberedMeetingDisplayName,
  normalizeMeetingDisplayName,
  resolveMeetingDisplayName,
  saveRememberedMeetingDisplayName,
} from '~/co-work/lib/meeting-display-name'
import { unlockWebAudioPlayback } from '~/co-work/lib/meeting-web'
import { maximizeGlobalSession } from '~/lib/session/global-session'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle } from '~/lib/platform/crossStyles'
import type { Meeting } from '~/co-work/lib/types'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppLayout } from '~/hooks/useAppLayout'
import { formatMeetingWhenLabel } from '~/co-work/lib/meeting-revisit'
import { addMeetingToDeviceCalendar } from '~/lib/calendar/device-calendar'
import { copyShareLink } from '~/lib/share'

const MeetingBackgroundPreview = lazy(() =>
  import('~/co-work/components/MeetingBackgroundPreview').then((mod) => ({
    default: mod.MeetingBackgroundPreview,
  })),
)

type MeetingLobbyScreenProps = {
  code: string
}

const JOIN_BUTTON_HEIGHT = 52

function ViewerNameBadge({
  name,
  muted,
  dangerColor,
}: {
  name: string
  muted: boolean
  dangerColor: string
}) {
  return (
    <XStack
      alignItems="center"
      gap="$2"
      paddingHorizontal="$2.5"
      paddingVertical={4}
      borderRadius={6}
      backgroundColor="rgba(0, 0, 0, 0.72)"
      maxWidth="100%"
    >
      {muted ? (
        <Icons.MicOff size={13} color={dangerColor} />
      ) : (
        <Icons.Mic size={13} color="#fff" />
      )}
      <Text fontSize={12} fontWeight="600" color="#fff" numberOfLines={1} flexShrink={1}>
        {name}
      </Text>
    </XStack>
  )
}

/** Pre-join lobby only — live room is `/meeting/:code/live` (MeetingLiveScreen). */
export function MeetingLobbyScreen({ code }: MeetingLobbyScreenProps) {
  return (
    <MeetingProvider>
      <MeetingLobbyScreenBody code={code} />
    </MeetingProvider>
  )
}

function MeetingLobbyScreenBody({ code }: MeetingLobbyScreenProps) {
  const {
    ui: coworkUi,
    gradients: coworkGradients,
    shadows: coworkShadows,
    scheme: coworkScheme,
  } = useCoWorkTheme()
  const linkBlue = coworkScheme === 'dark' ? '#5AA2FF' : '#0E72ED'
  const router = useRouter()
  const { isDesktop, isTablet, safeTop, safeBottom } = useAppLayout()
  const wide = isDesktop || isTablet
  const toast = useAppToast()
  const { profile, user, isAuthenticated, isLoading } = useProfile()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [passcode, setPasscode] = useState('')
  const [verified, setVerified] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMeeting, setLoadingMeeting] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [previewActive, setPreviewActive] = useState(true)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [showAudioTest, setShowAudioTest] = useState(false)
  const [alwaysShowPreview, setAlwaysShowPreview] = useState(true)
  const [doNotConnectAudio, setDoNotConnectAudio] = useState(false)
  const [turnOffVideo, setTurnOffVideo] = useState(false)
  const [joinDisplayName, setJoinDisplayName] = useState<string | undefined>(undefined)
  const [nameError, setNameError] = useState<string | null>(null)
  const nameEditedRef = useRef(false)
  const joiningRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void import('~/co-work/lib/meeting-join-preview-pref').then(({ loadAlwaysShowJoinPreview }) =>
      loadAlwaysShowJoinPreview().then((value) => {
        if (!cancelled) setAlwaysShowPreview(value)
      }),
    )
    return () => {
      cancelled = true
    }
  }, [])

  const isHost = !!meeting && !!user && meeting.host_id === user.id
  const hostDisplayName =
    meeting?.host?.full_name || meeting?.host?.username || (isHost ? 'You' : BRAND_MEMBER_LABEL)
  const resolvedJoinName =
    normalizeMeetingDisplayName(joinDisplayName) || resolveMeetingDisplayName({ profile, user })
  const viewerName = resolvedJoinName || 'Guest'
  const needsNameBeforeJoin = !resolvedJoinName
  const normalizedCode = code.replace(/\s/g, '').trim()

  useSyncMeetingLifecycle({
    inLobby: true,
    locked: isLocked && !isHost,
  })

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!normalizedCode) {
        setLoadingMeeting(false)
        setMeeting(null)
        setError('Missing meeting code. Go back to Meetings and try again.')
        return
      }

      if (!opts?.silent) setLoadingMeeting(true)
      setError(null)
      try {
        const row = await fetchMeetingByCode(normalizedCode)
        if (!row) {
          setError('Meeting not found. Check the code and try again.')
          setMeeting(null)
          return
        }
        if (row.status === 'cancelled') setError('The host cancelled this meeting.')
        setMeeting(row)

        const moderation = await fetchMeetingModerationSettings(row.id).catch(() => null)
        const locked = !!moderation?.is_locked
        setIsLocked(locked)
        if (locked && row.host_id !== user?.id) {
          setError(MEETING_LOCKED_MESSAGE)
        }

        const hostViewer = !!user && row.host_id === user.id
        if (
          !shouldPromptForPasscode({
            security: row.security_settings,
            isHost: hostViewer,
          })
        ) {
          setVerified(true)
        } else {
          setVerified(false)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load meeting')
      } finally {
        setLoadingMeeting(false)
      }
    },
    [normalizedCode, user?.id],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const prefs = loadMeetingJoinPrefs()
    if (!prefs) return
    setDoNotConnectAudio(!prefs.audioEnabled)
    setTurnOffVideo(!prefs.videoEnabled)
    if (prefs.displayName) setJoinDisplayName(prefs.displayName)
  }, [])

  // Pre-fill the editable name from the Join form, the remembered name or the account.
  useEffect(() => {
    let cancelled = false
    void loadRememberedMeetingDisplayName().then((remembered) => {
      if (cancelled || nameEditedRef.current) return
      const name = resolveMeetingDisplayName({
        typed: loadMeetingJoinPrefs()?.displayName,
        remembered,
        profile,
        user,
      })
      if (name) setJoinDisplayName(name)
    })
    return () => {
      cancelled = true
    }
  }, [profile, user])

  useEffect(() => {
    if (!meeting?.scheduled_at || meeting.status !== 'scheduled' || meeting.started_at) return
    const start = Date.parse(meeting.scheduled_at)
    if (!Number.isFinite(start) || start <= Date.now()) return
    const timer = setInterval(() => {
      const now = Date.now()
      setNowMs(now)
      if (now >= start) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [meeting])

  useEffect(() => {
    if (!meeting || isHost) return
    if (!isWaitingForScheduledStart(meeting)) return
    const timer = setInterval(() => {
      void load({ silent: true })
    }, 12_000)
    return () => clearInterval(timer)
  }, [meeting, isHost, load])

  async function handleVerifyPasscode() {
    if (!meeting) return
    const ok = await verifyMeetingPasscode(meeting.id, passcode)
    if (!ok) {
      toast.show('Incorrect passcode', { tone: 'error' })
      return
    }
    setVerified(true)
  }

  function enterLiveRoom(opts?: { videoEnabled?: boolean; audioEnabled?: boolean }) {
    if (!meeting) return
    if (joiningRef.current) return
    if (!canEnterLiveMeeting(meeting, { isHost })) {
      toast.show('This meeting has not started yet', {
        tone: 'info',
        message: `It is scheduled for ${formatMeetingWhenLabel(meeting)}.`,
      })
      return
    }
    if (isLocked && !isHost) {
      toast.show('Meeting locked', { tone: 'danger', message: MEETING_LOCKED_MESSAGE })
      return
    }
    joiningRef.current = true
    setPreviewActive(false)
    const confirmedName =
      normalizeMeetingDisplayName(joinDisplayName) || resolveMeetingDisplayName({ profile, user })
    if (!confirmedName) {
      joiningRef.current = false
      setPreviewActive(true)
      setNameError('Enter your name to join this meeting.')
      toast.show('Enter your name to join', { tone: 'info' })
      return
    }
    setNameError(null)
    if (nameEditedRef.current) void saveRememberedMeetingDisplayName(confirmedName)
    const preferredAudio = opts?.audioEnabled ?? !doNotConnectAudio
    const preferredVideo = opts?.videoEnabled ?? !turnOffVideo
    unlockWebAudioPlayback()
    void (async () => {
      if (!user) {
        try {
          await ensureGuestUserSession(confirmedName)
        } catch (guestErr) {
          joiningRef.current = false
          setPreviewActive(true)
          toast.show('Could not join as guest', {
            tone: 'error',
            message: guestErr instanceof Error ? guestErr.message : 'Please try again',
          })
          return
        }
      }
      const perms = await ensureMeetingMobilePermissions({
        requestNotifications: false,
        requestMicrophone: preferredAudio,
        requestCamera: preferredVideo,
      })
      if (!perms.ok) {
        joiningRef.current = false
        setPreviewActive(true)
        toast.show('Cannot join meeting', { tone: 'error', message: perms.message })
        return
      }
      const media = meetingJoinMediaFromPermissions(perms, {
        audioEnabled: preferredAudio,
        videoEnabled: preferredVideo,
      })
      openInstantMeetingSession({
        code: meeting.meeting_code,
        meeting,
        autoJoin: true,
        audioEnabled: media.audioEnabled,
        videoEnabled: media.videoEnabled,
        displayName: confirmedName,
      })
    })()
  }

  useEffect(() => {
    if (!meeting) return
    const instant = peekInstantMeetingSession()
    if (!instant?.enteredRoom) return
    if (!instantMeetingCodesMatch(instant.code, meeting.meeting_code)) return
    openInstantMeetingSession({
      code: meeting.meeting_code,
      meeting,
      autoJoin: true,
      enteredRoom: true,
      displayName: instant.displayName,
    })
    maximizeGlobalSession()
  }, [meeting])

  async function addToCalendar() {
    const result = await addMeetingToDeviceCalendar(meeting!)
    if (result === 'cancelled') return
    toast.show(
      result === 'saved' || result === 'opened'
        ? 'Meeting added to calendar'
        : result === 'shared'
          ? 'Calendar event ready'
          : 'Could not open calendar',
      {
        tone:
          result === 'saved' || result === 'opened' || result === 'shared' ? 'success' : 'danger',
      },
    )
  }

  const handleCopyLink = async () => {
    await copyShareLink(typeof window !== 'undefined' ? window.location.href : `https://sheconomy.in/co-work/meeting/${normalizedCode}`)
    toast.show('Meeting link copied to clipboard', { tone: 'success' })
  }

  if (loadingMeeting || (isLoading && !user)) {
    return (
      <ScreenCenter
        backgroundColor={coworkUi.pageBg}
        style={{
          paddingTop: Math.max(safeTop, 16),
          paddingBottom: Math.max(safeBottom, 16),
        }}
      >
        <Spinner size="large" color={coworkUi.brandLight} />
        <Text color={coworkUi.textSecondary} marginTop="$3">
          Preparing video preview…
        </Text>
      </ScreenCenter>
    )
  }

  const joinReady = meeting && verified && isMeetingJoinable(meeting)
  const waitingForStart = !!meeting && isWaitingForScheduledStart(meeting, nowMs)
  const title = meeting?.title ?? 'Personal Meeting Room'
  const codeLabel = meeting
    ? formatMeetingCode(meeting.meeting_code)
    : (normalizedCode || code).toUpperCase()

  return (
    <FullWidthLayout
      scroll
      backgroundColor={coworkUi.pageBg}
      style={{ minHeight: '100%', backgroundColor: coworkUi.pageBg }}
    >
      <PageSection
        paddingTop={wide ? 20 : Math.max(safeTop, 14)}
        paddingBottom={wide ? 32 : Math.max(safeBottom, 20) + 24}
        paddingHorizontal={wide ? '$4' : '$3'}
        {...LAYOUT_STRETCH}
      >
        {/* Centered Zoom Video Preview Window */}
        <YStack
          width="100%"
          maxWidth="100%"
          alignSelf="stretch"
          borderRadius={wide ? 20 : 16}
          borderWidth={1}
          borderColor={coworkUi.border}
          backgroundColor={coworkUi.surface}
          padding={wide ? '$5' : '$3.5'}
          gap={wide ? '$4' : '$3'}
          style={{
            boxShadow: coworkShadows.panel,
          }}
        >
          {/* Zoom Window Header Bar (Image 3: Cancel on top-left) */}
          <XStack
            alignItems="center"
            justifyContent="space-between"
            paddingTop={wide ? 0 : 4}
            paddingBottom="$1"
          >
            <Pressable
              onPress={() => router.push(coWorkRoutes.home as never)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text fontSize={15} fontWeight="700" color={linkBlue}>
                Cancel
              </Text>
            </Pressable>
            <XStack alignItems="center" gap="$1.5">
              <Icons.ShieldCheck size={16} color="#22C55E" />
              <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
                Sheconomy
              </Text>
            </XStack>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              onPress={() => router.push(coWorkRoutes.home as never)}
              style={{ padding: 4 }}
            >
              <Icons.X size={18} color={coworkUi.textMuted} />
            </Pressable>
          </XStack>

          {/* Meeting Details Sub-Header */}
          <YStack gap="$1" paddingBottom="$2" borderBottomWidth={1} borderColor={coworkUi.borderSoft}>
            <Text fontSize={wide ? 22 : 18} fontWeight="800" color={coworkUi.text} letterSpacing={-0.3} numberOfLines={2}>
              {title}
            </Text>
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Text color={coworkUi.brandLight} fontSize={13} fontWeight="700" letterSpacing={1}>
                {codeLabel}
              </Text>
              <Text color={coworkUi.textMuted} fontSize={13}>
                ·
              </Text>
              <Text color={coworkUi.textSecondary} fontSize={13} flexShrink={1} numberOfLines={1}>
                Host: {hostDisplayName}
              </Text>
              {meeting?.scheduled_at ? (
                <>
                  <Text color={coworkUi.textMuted} fontSize={13}>
                    ·
                  </Text>
                  <Text color={coworkUi.textSecondary} fontSize={13} flexShrink={1}>
                    {waitingForStart ? 'Starts' : 'Scheduled'} {formatMeetingWhenLabel(meeting)}
                  </Text>
                </>
              ) : null}
            </XStack>
          </YStack>

          {normalizedCode ? <MeetingOpenInApp meetingCode={normalizedCode} /> : null}

          {/* Error Banner */}
          {error ? (
            <YStack
              padding="$3.5"
              borderRadius={12}
              borderWidth={1}
              borderColor="rgba(244,63,104,0.35)"
              backgroundColor="rgba(244,63,104,0.12)"
            >
              <Text color={coworkUi.danger} fontSize={13} fontWeight="600">
                {error}
              </Text>
            </YStack>
          ) : null}

          {/* Passcode Verification Card if Required */}
          {meeting && !verified ? (
            <YStack
              gap="$3"
              padding="$4"
              borderRadius={14}
              backgroundColor={coworkUi.surfaceMuted}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
            >
              <XStack alignItems="center" gap="$3">
                <CoWorkIconBadge icon={Icons.Lock} />
                <YStack gap={2} flex={1}>
                  <Text fontWeight="700" fontSize={15} color={coworkUi.text}>
                    Meeting Passcode Required
                  </Text>
                  <Text color={coworkUi.textSecondary} fontSize={12}>
                    Please enter the passcode provided by the meeting host
                  </Text>
                </YStack>
              </XStack>
              {wide ? (
                <XStack gap="$2.5" width="100%" alignItems="stretch">
                  <Input
                    flex={1}
                    value={passcode}
                    onChangeText={setPasscode}
                    secureTextEntry
                    placeholder="Enter passcode"
                    backgroundColor={coworkUi.surfaceMuted}
                    borderColor={coworkUi.borderSoft}
                    color={coworkUi.text}
                    borderRadius={10}
                  />
                  <Button
                    tone="primary"
                    borderRadius={10}
                    height={44}
                    minHeight={44}
                    flexShrink={0}
                    onPress={() => void handleVerifyPasscode()}
                  >
                    Verify
                  </Button>
                </XStack>
              ) : (
                <YStack gap="$2.5" width="100%">
                  <Input
                    width="100%"
                    value={passcode}
                    onChangeText={setPasscode}
                    secureTextEntry
                    placeholder="Enter passcode"
                    backgroundColor={coworkUi.surfaceMuted}
                    borderColor={coworkUi.borderSoft}
                    color={coworkUi.text}
                    borderRadius={10}
                  />
                  <Button
                    tone="primary"
                    borderRadius={10}
                    height={44}
                    minHeight={44}
                    width="100%"
                    onPress={() => void handleVerifyPasscode()}
                  >
                    Verify
                  </Button>
                </YStack>
              )}
            </YStack>
          ) : null}

          {/* Video preview + join panel — Zoom-style preview card */}
          {joinReady ? (() => {
            const previewOverlayControls = (
              <YStack
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                zIndex={25}
                pointerEvents="box-none"
                justifyContent="space-between"
                padding="$2.5"
              >
                {/* Top row: Name badge on left, floating tools on right (Speaker, Flip, Effects) */}
                <XStack alignItems="center" justifyContent="space-between" width="100%" pointerEvents="box-none">
                  <ViewerNameBadge
                    name={viewerName}
                    muted={doNotConnectAudio}
                    dangerColor={coworkUi.danger}
                  />
                  <XStack alignItems="center" gap="$1.5" pointerEvents="auto">
                    <Pressable
                      onPress={() => setShowAudioTest(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Audio settings"
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pressed ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                      })}
                    >
                      <Icons.Volume2 size={16} color="#fff" />
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setPreviewActive(false)
                        setTimeout(() => setPreviewActive(true), 150)
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Flip camera"
                      hitSlop={8}
                      style={({ pressed }) => ({
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pressed ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.15)',
                      })}
                    >
                      <Icons.RefreshCw size={15} color="#fff" />
                    </Pressable>
                  </XStack>
                </XStack>

                {/* Bottom center: Mic and Camera toggles floating on video (Image 3) */}
                <XStack
                  alignItems="center"
                  justifyContent="center"
                  gap="$4"
                  width="100%"
                  pointerEvents="auto"
                  paddingBottom="$1"
                >
                  <Pressable
                    onPress={() => setDoNotConnectAudio((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={doNotConnectAudio ? 'Unmute microphone' : 'Mute microphone'}
                    style={({ pressed }) => ({
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: doNotConnectAudio
                        ? coworkUi.danger
                        : pressed
                          ? 'rgba(0,0,0,0.85)'
                          : 'rgba(0,0,0,0.65)',
                      borderWidth: 1.5,
                      borderColor: doNotConnectAudio ? coworkUi.danger : 'rgba(255,255,255,0.25)',
                    })}
                  >
                    {doNotConnectAudio ? (
                      <Icons.MicOff size={20} color="#fff" />
                    ) : (
                      <Icons.Mic size={20} color="#fff" />
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => setTurnOffVideo((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={turnOffVideo ? 'Turn camera on' : 'Turn camera off'}
                    style={({ pressed }) => ({
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: turnOffVideo
                        ? coworkUi.danger
                        : pressed
                          ? 'rgba(0,0,0,0.85)'
                          : 'rgba(0,0,0,0.65)',
                      borderWidth: 1.5,
                      borderColor: turnOffVideo ? coworkUi.danger : 'rgba(255,255,255,0.25)',
                    })}
                  >
                    {turnOffVideo ? (
                      <Icons.VideoOff size={20} color="#fff" />
                    ) : (
                      <Icons.Video size={20} color="#fff" />
                    )}
                  </Pressable>
                </XStack>
              </YStack>
            )

            return (
              <YStack width="100%" gap="$3">
                <YStack width="100%" maxWidth={wide ? 560 : undefined} alignSelf="center">
                  {!turnOffVideo ? (
                    <Suspense
                      fallback={
                        <YStack
                          width="100%"
                          aspectRatio={16 / 9}
                          borderRadius={16}
                          overflow="hidden"
                          backgroundColor="#0a0a0c"
                          alignItems="center"
                          justifyContent="center"
                          gap="$2"
                        >
                          <Spinner size="small" color={coworkUi.brandLight} />
                          <Text fontSize={12} color={coworkUi.textMuted}>
                            Starting camera preview…
                          </Text>
                        </YStack>
                      }
                    >
                      <MeetingBackgroundPreview
                        userId={user?.id}
                        active={previewActive}
                        videoOverlay={previewOverlayControls}
                      />
                    </Suspense>
                  ) : (
                    <YStack
                      width="100%"
                      aspectRatio={16 / 9}
                      borderRadius={16}
                      overflow="hidden"
                      backgroundColor={coworkUi.tileBg}
                      borderWidth={1}
                      borderColor={coworkUi.border}
                      position="relative"
                      alignItems="center"
                      justifyContent="center"
                      flexShrink={0}
                    >
                      <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
                        <Avatar
                          size="$6"
                          name={viewerName}
                          src={profile?.avatar_url || undefined}
                          fallbackBackgroundColor={coworkUi.brandMuted}
                        />
                        <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
                          {viewerName}
                        </Text>
                        <Text fontSize={12} color={coworkUi.textMuted}>
                          Video is turned off
                        </Text>
                      </YStack>
                      {previewOverlayControls}
                    </YStack>
                  )}
                </YStack>

                <YStack width="100%" maxWidth={wide ? 560 : undefined} alignSelf="center" gap="$3">
                  {needsNameBeforeJoin ? (
                    <YStack gap="$1.5" width="100%">
                      <Text fontSize={12} fontWeight="700" color={coworkUi.textSecondary}>
                        Your Name (Display Name)
                      </Text>
                      <Input
                        value={joinDisplayName ?? ''}
                        onChangeText={(value) => {
                          nameEditedRef.current = true
                          if (nameError) setNameError(null)
                          setJoinDisplayName(value)
                        }}
                        maxLength={80}
                        accessibilityLabel="Your name in the meeting"
                        placeholder="Enter your name"
                        backgroundColor={coworkUi.surfaceMuted}
                        borderColor={coworkUi.borderSoft}
                        color={coworkUi.text}
                        placeholderTextColor={coworkUi.textMuted}
                        borderRadius={10}
                        fontSize={15}
                        height={46}
                      />
                      {nameError ? (
                        <Text fontSize={12} color={coworkUi.danger}>
                          {nameError}
                        </Text>
                      ) : null}
                    </YStack>
                  ) : (
                    <XStack
                      alignItems="center"
                      justifyContent="center"
                      gap="$2"
                      paddingVertical="$2"
                      paddingHorizontal="$3"
                      borderRadius={10}
                      backgroundColor={coworkUi.surfaceMuted}
                      borderWidth={1}
                      borderColor={coworkUi.borderSoft}
                    >
                      <Icons.User size={15} color={coworkUi.textMuted} />
                      <Text fontSize={13} color={coworkUi.textSecondary}>
                        Joining as
                      </Text>
                      <Text fontSize={13} fontWeight="800" color={coworkUi.text} numberOfLines={1} flexShrink={1}>
                        {viewerName}
                      </Text>
                    </XStack>
                  )}

                  {/* Zoom Start / Join CTA button */}
                  <Button
                    width="100%"
                    height={JOIN_BUTTON_HEIGHT}
                    minHeight={JOIN_BUTTON_HEIGHT}
                    maxHeight={JOIN_BUTTON_HEIGHT}
                    tone="primary"
                    size="$5"
                    borderRadius={12}
                    disabled={isLocked && !isHost}
                    opacity={isLocked && !isHost ? 0.55 : 1}
                    color="#fff"
                    backgroundColor="#0E72ED"
                    fontWeight="700"
                    onPress={() =>
                      enterLiveRoom({
                        videoEnabled: !turnOffVideo,
                        audioEnabled: !doNotConnectAudio,
                      })
                    }
                    style={{
                      height: JOIN_BUTTON_HEIGHT,
                      minHeight: JOIN_BUTTON_HEIGHT,
                      backgroundColor: '#0E72ED',
                    }}
                  >
                    {isLocked && !isHost
                      ? 'Meeting Locked'
                      : waitingForStart && isHost
                        ? 'Start'
                        : isHost
                          ? 'Start'
                          : !user
                            ? 'Join as Guest'
                            : 'Join'}
                  </Button>

                  {!user ? (
                    <XStack justifyContent="center" alignItems="center" gap="$1" paddingVertical="$1">
                      <Text fontSize={12} color={coworkUi.textMuted}>
                        Already have an account?
                      </Text>
                      <Pressable
                        onPress={() =>
                          router.push(
                            `/auth/sign-in?returnTo=${encodeURIComponent(
                              coWorkRoutes.meeting(normalizedCode || code),
                            )}` as never,
                          )
                        }
                      >
                        <Text fontSize={12} fontWeight="700" color={linkBlue}>
                          Sign in
                        </Text>
                      </Pressable>
                    </XStack>
                  ) : null}

                  {/* Always show this preview checkbox (Image 3) */}
                  <XStack
                    alignItems="center"
                    justifyContent="center"
                    gap="$2.5"
                    width="100%"
                    cursor="pointer"
                    onPress={() => {
                      setAlwaysShowPreview((v) => {
                        const next = !v
                        void import('~/co-work/lib/meeting-join-preview-pref').then(({ saveAlwaysShowJoinPreview }) =>
                          saveAlwaysShowJoinPreview(next),
                        )
                        return next
                      })
                    }}
                  >
                    <Checkbox
                      checked={alwaysShowPreview}
                      onCheckedChange={(c) => {
                        const next = Boolean(c)
                        setAlwaysShowPreview(next)
                        void import('~/co-work/lib/meeting-join-preview-pref').then(({ saveAlwaysShowJoinPreview }) =>
                          saveAlwaysShowJoinPreview(next),
                        )
                      }}
                      flexShrink={0}
                    />
                    <Text fontSize={13} color={coworkUi.textSecondary} flexShrink={1}>
                      Always show this preview when joining
                    </Text>
                  </XStack>
                </YStack>

                {/* Waiting notice if scheduled and not started */}
                {waitingForStart && !isHost ? (
                  <YStack
                    gap="$2"
                    padding="$3.5"
                    borderRadius={12}
                    borderWidth={1}
                    borderColor={coworkUi.border}
                    backgroundColor={coworkUi.surfaceMuted}
                  >
                    <XStack alignItems="center" gap="$2">
                      <Icons.Clock size={16} color={coworkUi.brandLight} />
                      <Text fontWeight="700" fontSize={14} color={coworkUi.text}>
                        This meeting has not started yet
                      </Text>
                    </XStack>
                    <Text color={coworkUi.textSecondary} fontSize={13} lineHeight={19}>
                      It is scheduled for {formatMeetingWhenLabel(meeting!)}. You will enter as soon as the host starts.
                    </Text>
                  </YStack>
                ) : null}

                {/* Utility buttons row */}
                <XStack
                  alignItems="center"
                  justifyContent="center"
                  gap="$2.5"
                  paddingTop="$3"
                  flexWrap="wrap"
                  width="100%"
                  borderTopWidth={1}
                  borderColor={coworkUi.borderSoft}
                >
                  <Button
                    tone="outline"
                    size="$3"
                    borderRadius={8}
                    borderColor={coworkUi.border}
                    backgroundColor={coworkUi.surface}
                    onPress={handleCopyLink}
                    icon={<Icons.Copy size={14} color={coworkUi.text} />}
                  >
                    <Text fontSize={12} fontWeight="600" color={coworkUi.text}>
                      Copy Link
                    </Text>
                  </Button>

                  <Button
                    tone="outline"
                    size="$3"
                    borderRadius={8}
                    borderColor={coworkUi.border}
                    backgroundColor={coworkUi.surface}
                    onPress={() => setShareOpen(true)}
                    icon={<Icons.Share2 size={14} color={coworkUi.text} />}
                  >
                    <Text fontSize={12} fontWeight="600" color={coworkUi.text}>
                      Share
                    </Text>
                  </Button>

                  {isHost ? (
                    <Button
                      tone="outline"
                      size="$3"
                      borderRadius={8}
                      borderColor={coworkUi.border}
                      backgroundColor={coworkUi.surface}
                      icon={<Icons.UserPlus size={14} color={coworkUi.text} />}
                      onPress={() => setShowInvite((open) => !open)}
                    >
                      <Text fontSize={12} fontWeight="600" color={coworkUi.text}>
                        {showInvite ? 'Hide Invite' : 'Invite'}
                      </Text>
                    </Button>
                  ) : null}

                  <MeetingCalendarIconButton onPress={() => void addToCalendar()} />
                </XStack>

                <MeetingShareSheet open={shareOpen} onOpenChange={setShareOpen} meeting={meeting!} />
              </YStack>
            )
          })() : null}

          {/* Host Invite Drawer */}
          {isHost && showInvite && user && meeting ? (
            <YStack
              height={360}
              borderRadius={14}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              overflow="hidden"
              backgroundColor={coworkUi.surface}
            >
              <MeetingInvitePanel
                meeting={meeting}
                hostId={user.id}
                hostName={viewerName}
                onClose={() => setShowInvite(false)}
                fullWidth
                onInviteesUpdated={(next) =>
                  setMeeting((current) => (current ? { ...current, invitees: next } : current))
                }
              />
            </YStack>
          ) : null}

          {/* Clean Subtle Footer Links */}
          <XStack
            alignItems="center"
            justifyContent="center"
            gap={wide ? '$4' : '$3'}
            paddingTop="$2"
            flexWrap="wrap"
            width="100%"
          >
            <AppLink href={coWorkRoutes.home} asChild>
              <Text fontSize={13} color={coworkUi.textMuted} cursor="pointer" pressStyle={{ opacity: 0.7 }}>
                Back to Meetings
              </Text>
            </AppLink>
          </XStack>
        </YStack>
      </PageSection>

      {/* Audio Test Modal */}
      {showAudioTest ? (
        <MeetingAudioTestModal
          open={showAudioTest}
          onOpenChange={setShowAudioTest}
          onClose={() => setShowAudioTest(false)}
        />
      ) : null}
    </FullWidthLayout>
  )
}
