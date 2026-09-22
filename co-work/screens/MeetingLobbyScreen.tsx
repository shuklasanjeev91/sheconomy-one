import { AppLink } from '~/components/navigation/AppLink'
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Pressable } from 'react-native'
import { useRouter } from 'one'

import { AuthSignInFlow } from '~/components/auth/AuthSignInFlow'
import { FullWidthLayout, LAYOUT_STRETCH, PageSection, ScreenCenter } from '~/components/layout'
import { BRAND_MEMBER_LABEL } from '~/config/brand'
import { MeetingShareSheet } from '~/co-work/components/MeetingShareSheet'
import { MeetingCalendarIconButton } from '~/co-work/components/MeetingCalendarIconButton'
import { MeetingAudioTestModal } from '~/co-work/components/MeetingAudioTestModal'
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
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const router = useRouter()
  const { isDesktop, isTablet } = useAppLayout()
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
  const viewerName = profile?.full_name || profile?.username || 'You'
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
    const preferredAudio = opts?.audioEnabled ?? !doNotConnectAudio
    const preferredVideo = opts?.videoEnabled ?? !turnOffVideo
    unlockWebAudioPlayback()
    void (async () => {
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
        displayName: joinDisplayName,
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
      <ScreenCenter backgroundColor="#0c080a">
        <Spinner size="large" color={coworkUi.brand} />
        <Text color={coworkUi.textSecondary} marginTop="$3">
          Preparing video preview…
        </Text>
      </ScreenCenter>
    )
  }

  if (!isAuthenticated || !user) {
    return <AuthSignInFlow returnTo={String(coWorkRoutes.meeting(normalizedCode || code))} />
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
      backgroundColor="#0c080a"
      style={{ minHeight: '100%', backgroundColor: '#0c080a' }}
    >
      <PageSection
        paddingVertical={wide ? '$4' : '$3'}
        paddingBottom="$8"
        {...LAYOUT_STRETCH}
      >
        {/* Centered Zoom Video Preview Window */}
        <YStack
          width="100%"
          maxWidth="100%"
          alignSelf="stretch"
          borderRadius={wide ? 20 : 16}
          borderWidth={1}
          borderColor="rgba(255, 255, 255, 0.12)"
          backgroundColor="rgba(22, 18, 24, 0.96)"
          padding={wide ? '$5' : '$3.5'}
          gap={wide ? '$4' : '$3'}
          style={{
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
          }}
        >
          {/* Zoom Window Header Bar */}
          <XStack alignItems="center" justifyContent="space-between" paddingBottom="$1">
            <XStack alignItems="center" gap="$2">
              <Icons.Video size={17} color={coworkUi.brand} />
              <Text fontSize={15} fontWeight="700" color="#ffffff" letterSpacing={0.2}>
                Video Preview
              </Text>
            </XStack>
            <XStack
              cursor="pointer"
              padding="$1.5"
              borderRadius={999}
              pressStyle={{ opacity: 0.7 }}
              onPress={() => router.push(coWorkRoutes.home as never)}
            >
              <Icons.X size={18} color={coworkUi.textMuted} />
            </XStack>
          </XStack>

          {/* Meeting Details Sub-Header */}
          <YStack gap="$1" paddingBottom="$2" borderBottomWidth={1} borderColor="rgba(255, 255, 255, 0.08)">
            <Text fontSize={wide ? 22 : 18} fontWeight="800" color="#ffffff" letterSpacing={-0.3} numberOfLines={2}>
              {title}
            </Text>
            <XStack alignItems="center" gap="$2" flexWrap="wrap">
              <Text color={coworkUi.brandLight} fontSize={13} fontWeight="700" letterSpacing={1}>
                {codeLabel}
              </Text>
              <Text color="rgba(255,255,255,0.4)" fontSize={13}>
                ·
              </Text>
              <Text color={coworkUi.textSecondary} fontSize={13} flexShrink={1} numberOfLines={1}>
                Host: {hostDisplayName}
              </Text>
              {meeting?.scheduled_at ? (
                <>
                  <Text color="rgba(255,255,255,0.4)" fontSize={13}>
                    ·
                  </Text>
                  <Text color={coworkUi.textSecondary} fontSize={13} flexShrink={1}>
                    {waitingForStart ? 'Starts' : 'Scheduled'} {formatMeetingWhenLabel(meeting)}
                  </Text>
                </>
              ) : null}
            </XStack>
          </YStack>

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
              backgroundColor="rgba(32, 26, 34, 0.9)"
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
            >
              <XStack alignItems="center" gap="$3">
                <CoWorkIconBadge icon={Icons.Lock} />
                <YStack gap={2} flex={1}>
                  <Text fontWeight="700" fontSize={15} color="#fff">
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
                    backgroundColor="rgba(0,0,0,0.5)"
                    borderColor={coworkUi.borderSoft}
                    color="#fff"
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
                    backgroundColor="rgba(0,0,0,0.5)"
                    borderColor={coworkUi.borderSoft}
                    color="#fff"
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

          {/* Video preview + join panel — split on desktop, stacked on tablet/mobile */}
          {joinReady ? (
            <YStack width="100%" gap="$3">
              <XStack
                width="100%"
                gap={isDesktop ? '$5' : '$3'}
                flexWrap={isDesktop ? 'nowrap' : 'wrap'}
                alignItems={isDesktop ? 'flex-start' : 'stretch'}
              >
                <YStack
                  flexGrow={1}
                  flexShrink={1}
                  flexBasis={isDesktop ? '0%' : '100%'}
                  width={isDesktop ? undefined : '100%'}
                  minWidth={0}
                >
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
                          <Spinner size="small" color={coworkUi.brand} />
                          <Text fontSize={12} color={coworkUi.textMuted}>
                            Starting camera preview…
                          </Text>
                        </YStack>
                      }
                    >
                      <MeetingBackgroundPreview
                        userId={user?.id}
                        active={previewActive}
                        videoOverlay={
                          <ViewerNameBadge
                            name={viewerName}
                            muted={doNotConnectAudio}
                            dangerColor={coworkUi.danger}
                          />
                        }
                      />
                    </Suspense>
                  ) : (
                    <YStack
                      width="100%"
                      aspectRatio={16 / 9}
                      borderRadius={16}
                      overflow="hidden"
                      backgroundColor="#0a0a0c"
                      borderWidth={1}
                      borderColor="rgba(255, 255, 255, 0.12)"
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
                          fallbackBackgroundColor="rgba(255,255,255,0.08)"
                        />
                        <Text fontSize={14} fontWeight="700" color="#fff">
                          {viewerName}
                        </Text>
                        <Text fontSize={12} color={coworkUi.textMuted}>
                          Video is turned off
                        </Text>
                      </YStack>
                      <YStack position="absolute" left={12} bottom={12} zIndex={20} maxWidth="75%">
                        <ViewerNameBadge
                          name={viewerName}
                          muted={doNotConnectAudio}
                          dangerColor={coworkUi.danger}
                        />
                      </YStack>
                    </YStack>
                  )}
                </YStack>

                <YStack
                  flexGrow={1}
                  flexShrink={1}
                  flexBasis={isDesktop ? '0%' : '100%'}
                  width={isDesktop ? undefined : '100%'}
                  minWidth={isDesktop ? 320 : undefined}
                  gap="$3"
                >
              <YStack gap="$3" paddingTop="$1" width="100%">
                <XStack
                  alignItems="flex-start"
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
                  <Text fontSize={13} color={coworkUi.textSecondary} flex={1} flexShrink={1} lineHeight={18}>
                    Always show this preview when joining
                  </Text>
                </XStack>

                {isDesktop ? (
                  <XStack
                    alignItems="center"
                    gap="$1.5"
                    cursor="pointer"
                    pressStyle={{ opacity: 0.7 }}
                    onPress={() => setShowAudioTest(true)}
                    alignSelf="flex-start"
                  >
                    <Icons.Volume2 size={15} color={coworkUi.brandLight} />
                    <Text fontSize={13} fontWeight="700" color={coworkUi.brandLight}>
                      Test Speaker and Microphone
                    </Text>
                  </XStack>
                ) : null}

                <XStack alignItems="center" justifyContent="center" gap="$5" paddingVertical="$2">
                  <Pressable
                    onPress={() => setDoNotConnectAudio((v) => !v)}
                    accessibilityLabel={doNotConnectAudio ? 'Unmute microphone' : 'Mute microphone'}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: doNotConnectAudio
                        ? coworkUi.danger
                        : 'rgba(255,255,255,0.14)',
                    }}
                  >
                    {doNotConnectAudio ? (
                      <Icons.MicOff size={22} color="#fff" />
                    ) : (
                      <Icons.Mic size={22} color="#fff" />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => setTurnOffVideo((v) => !v)}
                    accessibilityLabel={turnOffVideo ? 'Turn camera on' : 'Turn camera off'}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: turnOffVideo
                        ? coworkUi.danger
                        : 'rgba(255,255,255,0.14)',
                    }}
                  >
                    {turnOffVideo ? (
                      <Icons.VideoOff size={22} color="#fff" />
                    ) : (
                      <Icons.Video size={22} color="#fff" />
                    )}
                  </Pressable>
                </XStack>
              </YStack>

              {/* Waiting notice if scheduled and not started */}
              {waitingForStart && !isHost ? (
                <YStack
                  gap="$2"
                  padding="$3.5"
                  borderRadius={12}
                  borderWidth={1}
                  borderColor="rgba(255, 255, 255, 0.1)"
                  backgroundColor="rgba(255, 255, 255, 0.04)"
                >
                  <XStack alignItems="center" gap="$2">
                    <Icons.Clock size={16} color={coworkUi.brand} />
                    <Text fontWeight="700" fontSize={14} color="#fff">
                      This meeting has not started yet
                    </Text>
                  </XStack>
                  <Text color={coworkUi.textSecondary} fontSize={13} lineHeight={19}>
                    It is scheduled for {formatMeetingWhenLabel(meeting!)}. You will enter as soon as the host starts.
                  </Text>
                </YStack>
              ) : null}

              {/* Zoom Start / Join CTA — single primary on tablet & phone; dual on large desktop web */}
              <YStack width="100%" gap="$3" paddingTop="$2" flexShrink={0}>
                {!isDesktop ? (
                  <Button
                    width="100%"
                    height={JOIN_BUTTON_HEIGHT}
                    minHeight={JOIN_BUTTON_HEIGHT}
                    maxHeight={JOIN_BUTTON_HEIGHT}
                    flexGrow={0}
                    flexShrink={0}
                    tone="primary"
                    size="$5"
                    borderRadius={12}
                    disabled={isLocked && !isHost}
                    opacity={isLocked && !isHost ? 0.55 : 1}
                    color="#fff"
                    backgroundColor={coworkUi.brand}
                    onPress={() =>
                      enterLiveRoom({
                        videoEnabled: !turnOffVideo,
                        audioEnabled: !doNotConnectAudio,
                      })
                    }
                    style={{
                      ...controlGradientStyle(coworkGradients.activeControl, coworkUi.brand),
                      height: JOIN_BUTTON_HEIGHT,
                      minHeight: JOIN_BUTTON_HEIGHT,
                    }}
                  >
                    {isLocked && !isHost
                      ? 'Meeting Locked'
                      : waitingForStart && isHost
                        ? 'Start'
                        : 'Join'}
                  </Button>
                ) : (
                  <>
                <Button
                  width="100%"
                  height={JOIN_BUTTON_HEIGHT}
                  minHeight={JOIN_BUTTON_HEIGHT}
                  maxHeight={JOIN_BUTTON_HEIGHT}
                  flexGrow={0}
                  flexShrink={0}
                  tone="primary"
                  size="$5"
                  borderRadius={10}
                  disabled={isLocked && !isHost}
                  opacity={isLocked && !isHost ? 0.55 : 1}
                  color="#fff"
                  icon={<Icons.Video size={19} color="#fff" />}
                  onPress={() => enterLiveRoom({ videoEnabled: true })}
                  style={{
                    ...controlGradientStyle(coworkGradients.activeControl, coworkUi.brand),
                    height: JOIN_BUTTON_HEIGHT,
                    minHeight: JOIN_BUTTON_HEIGHT,
                  }}
                >
                  {isLocked && !isHost
                    ? 'Meeting Locked'
                    : waitingForStart && isHost
                      ? 'Start with Video'
                      : 'Join with Video'}
                </Button>

                <Button
                  width="100%"
                  height={JOIN_BUTTON_HEIGHT}
                  minHeight={JOIN_BUTTON_HEIGHT}
                  maxHeight={JOIN_BUTTON_HEIGHT}
                  flexGrow={0}
                  flexShrink={0}
                  tone="outline"
                  size="$5"
                  borderRadius={10}
                  disabled={isLocked && !isHost}
                  opacity={isLocked && !isHost ? 0.55 : 1}
                  borderColor="rgba(255, 255, 255, 0.22)"
                  backgroundColor="rgba(255, 255, 255, 0.1)"
                  color="#ffffff"
                  icon={<Icons.VideoOff size={19} color="#ffffff" />}
                  onPress={() => enterLiveRoom({ videoEnabled: false })}
                >
                  {isLocked && !isHost
                    ? 'Meeting Locked'
                    : waitingForStart && isHost
                      ? 'Start without Video'
                      : 'Join without Video'}
                </Button>
                  </>
                )}
              </YStack>

              {/* Utility buttons row */}
              <XStack
                alignItems="center"
                justifyContent="center"
                gap="$2.5"
                paddingTop="$3"
                flexWrap="wrap"
                width="100%"
                borderTopWidth={1}
                borderColor="rgba(255, 255, 255, 0.08)"
              >
                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={8}
                  borderColor="rgba(255, 255, 255, 0.14)"
                  backgroundColor="rgba(255, 255, 255, 0.04)"
                  onPress={handleCopyLink}
                  icon={<Icons.Copy size={14} color="#fff" />}
                >
                  <Text fontSize={12} fontWeight="600" color="#fff">
                    Copy Link
                  </Text>
                </Button>

                <Button
                  tone="outline"
                  size="$3"
                  borderRadius={8}
                  borderColor="rgba(255, 255, 255, 0.14)"
                  backgroundColor="rgba(255, 255, 255, 0.04)"
                  onPress={() => setShareOpen(true)}
                  icon={<Icons.Share2 size={14} color="#fff" />}
                >
                  <Text fontSize={12} fontWeight="600" color="#fff">
                    Share
                  </Text>
                </Button>

                {isHost ? (
                  <Button
                    tone="outline"
                    size="$3"
                    borderRadius={8}
                    borderColor="rgba(255, 255, 255, 0.14)"
                    backgroundColor="rgba(255, 255, 255, 0.04)"
                    icon={<Icons.UserPlus size={14} color="#fff" />}
                    onPress={() => setShowInvite((open) => !open)}
                  >
                    <Text fontSize={12} fontWeight="600" color="#fff">
                      {showInvite ? 'Hide Invite' : 'Invite'}
                    </Text>
                  </Button>
                ) : null}

                <MeetingCalendarIconButton onPress={() => void addToCalendar()} />
              </XStack>
                </YStack>
              </XStack>

              <MeetingShareSheet open={shareOpen} onOpenChange={setShareOpen} meeting={meeting!} />
            </YStack>
          ) : null}

          {/* Host Invite Drawer */}
          {isHost && showInvite && user && meeting ? (
            <YStack
              height={360}
              borderRadius={14}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              overflow="hidden"
              backgroundColor="rgba(18, 14, 20, 0.95)"
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
            <Text color="rgba(255,255,255,0.2)" fontSize={12}>
              ·
            </Text>
            <AppLink href={`sheconomy://co-work/meeting/${normalizedCode}` as never} asChild>
              <Text
                fontSize={13}
                color={coworkUi.brandLight}
                cursor="pointer"
                pressStyle={{ opacity: 0.7 }}
                textAlign="center"
              >
                Prefer mobile app? Open in Sheconomy
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
