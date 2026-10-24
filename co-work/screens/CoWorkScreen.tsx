import { useRouter } from 'one'
import { useEffect, useState } from 'react'

import { AppLink } from '~/components/navigation/AppLink'
import { PageContent, LAYOUT_STRETCH } from '~/components/layout'
import { IdleMount } from '~/components/IdleMount'
import { RecentMeetingRevisitStrip } from '~/co-work/components/RecentMeetingRevisitStrip'
import { UpcomingMeetingsStrip } from '~/co-work/components/UpcomingMeetingsStrip'
import {
  recordMeetingCode,
  useRecentMeetingCodes,
} from '~/co-work/lib/recent-meeting-codes'
import {
  ensureMeetingMobilePermissions,
  meetingJoinMediaFromPermissions,
} from '~/co-work/lib/meeting-media-permissions'
import { openInstantMeetingSession } from '~/co-work/lib/instant-meeting-session'
import { meetingJoinPrefsFromCheckboxes, saveMeetingJoinPrefs } from '~/co-work/lib/meeting-join-prefs'
import { normalizeMeetingDisplayName, resolveMeetingDisplayName } from '~/co-work/lib/meeting-display-name'
import { formatPersonalMeetingDisplayCode } from '~/co-work/lib/meeting-pmi'
import { unlockWebAudioPlayback } from '~/co-work/lib/meeting-web'
import {
  Button,
  Checkbox,
  Icons,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { MeetingActionTile, MeetingDigitalClock } from '~/co-work/components/CoWorkUi'
import { MeetingStartSheet } from '~/co-work/components/MeetingStartSheet'
import { createMeeting, fetchMeetingByCode, meetingCodeFromInput } from '~/co-work/lib/meetings'
import { SHECONOMY_MEETING_COLORS, useCoWorkTheme } from '~/co-work/lib/theme'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppLayout } from '~/hooks/useAppLayout'
import { buildAppUrl } from '~/config/app-origin'
import { copyShareLink } from '~/lib/share'
import { BRAND_NAME } from '~/config/brand'

export function CoWorkScreen() {
  const { ui } = useCoWorkTheme()
  const router = useRouter()
  const toast = useAppToast()
  const { user, profile, isAuthenticated } = useProfile()
  const { isDesktop, isTablet } = useAppLayout()
  const wide = isDesktop || isTablet
  const recentCodes = useRecentMeetingCodes()

  // State
  const [creating, setCreating] = useState(false)
  const [startWithVideo, setStartWithVideo] = useState(true)
  const [usePmi, setUsePmi] = useState(false)
  const [showStartSheet, setShowStartSheet] = useState(false)
  const [showTileDropdown, setShowTileDropdown] = useState(false)

  // Join dialog state
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinDisplayName, setJoinDisplayName] = useState(
    () => profile?.full_name?.trim() || profile?.username?.trim() || '',
  )
  const [joining, setJoining] = useState(false)
  const [doNotConnectAudio, setDoNotConnectAudio] = useState(false)
  const [turnOffVideo, setTurnOffVideo] = useState(false)
  const [joinNameError, setJoinNameError] = useState<string | null>(null)

  // Share screen quick prompt
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareCode, setShareCode] = useState('')

  // Meetings refresh
  const [meetingsRefreshKey, setMeetingsRefreshKey] = useState(0)

  // Personal Meeting ID — durable stored code when available.
  const [userPmi, setUserPmi] = useState(() =>
    formatPersonalMeetingDisplayCode(user?.id || ''),
  )

  useEffect(() => {
    if (!user?.id) return
    void import('~/co-work/lib/meeting-pmi').then(({ loadStoredPmiMeetingCode, formatPersonalMeetingDisplayCode }) =>
      loadStoredPmiMeetingCode(user.id).then((stored) => {
        if (stored) {
          const plain = stored.replace(/\s/g, '')
          setUserPmi(
            plain.length === 9
              ? `${plain.slice(0, 3)} ${plain.slice(3, 6)} ${plain.slice(6)}`
              : stored,
          )
        } else {
          setUserPmi(formatPersonalMeetingDisplayCode(user.id))
        }
      }),
    )
  }, [user?.id])

  async function startInstantMeeting(options?: {
    videoOn?: boolean
    usePmi?: boolean
    whiteboard?: boolean
    title?: string
  }) {
    if (creating) return
    if (!user) {
      toast.show('Sign in required', {
        tone: 'info',
        message: 'Please sign in to start a meeting.',
      })
      router.push('/auth/sign-in' as never)
      return
    }
    const isWhiteboard = options?.whiteboard ?? false
    const videoOn = isWhiteboard ? false : (options?.videoOn ?? startWithVideo)
    const withPmi = isWhiteboard ? false : (options?.usePmi ?? usePmi)
    setStartWithVideo(videoOn)
    setUsePmi(withPmi)
    setCreating(true)
    try {
      unlockWebAudioPlayback()
      const perms = await ensureMeetingMobilePermissions({
        requestNotifications: false,
        requestMicrophone: true,
        requestCamera: videoOn,
      })
      if (!perms.ok) {
        toast.show('Cannot start meeting', {
          tone: 'error',
          message: perms.message,
        })
        return
      }
      const media = meetingJoinMediaFromPermissions(perms, { videoEnabled: videoOn })

      const hostLabel = profile?.full_name?.trim() || profile?.username?.trim() || BRAND_NAME
      const customTitle = options?.title?.trim()
      const meetingTitle = customTitle
        ? customTitle
        : isWhiteboard
          ? `${hostLabel}'s Whiteboard Session`
          : withPmi
            ? `${hostLabel}'s Personal Meeting Room`
            : `${hostLabel}'s Meeting`
      const meeting = withPmi
        ? await (
            await import('~/co-work/lib/meeting-pmi')
          ).startOrReusePersonalMeeting(user.id, {
            title: meetingTitle,
            startNow: true,
            securitySettings: {
              videoOffOnJoin: !videoOn,
            },
          })
        : await createMeeting(user.id, {
            title: meetingTitle,
            startNow: true,
            securitySettings: {
              videoOffOnJoin: !videoOn,
            },
          })

      if (withPmi && meeting.meeting_code) {
        const plain = meeting.meeting_code.replace(/\s/g, '')
        setUserPmi(
          plain.length === 9
            ? `${plain.slice(0, 3)} ${plain.slice(3, 6)} ${plain.slice(6)}`
            : meeting.meeting_code,
        )
      }

      if (!meeting.meeting_code) {
        throw new Error('Meeting was created without a join code. Please try again.')
      }

      recordMeetingCode(meeting.meeting_code)
      openInstantMeetingSession({
        code: meeting.meeting_code,
        meeting,
        autoJoin: true,
        audioEnabled: media.audioEnabled,
        videoEnabled: media.videoEnabled,
      })
      if (!media.audioEnabled) {
        toast.show('Joining without microphone', {
          tone: 'info',
          message: perms.message ?? 'Tap Unmute in the meeting to allow access.',
        })
      }
    } catch (createError) {
      toast.show('Could not start meeting', {
        tone: 'error',
        message: createError instanceof Error ? createError.message : undefined,
      })
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(targetCode: string, directShare = false) {
    const normalized = meetingCodeFromInput(targetCode)
    if (!normalized || joining) return
    const confirmedName =
      normalizeMeetingDisplayName(joinDisplayName) || resolveMeetingDisplayName({ profile, user })
    if (!confirmedName) {
      setJoinNameError('Enter your name to join this meeting.')
      toast.show('Enter your name to join', { tone: 'info' })
      return
    }
    setJoinNameError(null)
    recordMeetingCode(normalized)
    if (!directShare) {
      // Same preview as an invite link: edit the name, pick a background, then join.
      unlockWebAudioPlayback()
      saveMeetingJoinPrefs({
        ...meetingJoinPrefsFromCheckboxes({ doNotConnectAudio, turnOffVideo }),
        displayName: confirmedName,
      })
      setShowJoinModal(false)
      router.push(coWorkRoutes.meeting(normalized))
      return
    }
    setJoining(true)
    try {
      // Unlock playback and request mic in this click before any network await —
      // Chrome consumes the user gesture after the first await.
      unlockWebAudioPlayback()
      const preferred = meetingJoinPrefsFromCheckboxes({ doNotConnectAudio, turnOffVideo })
      const perms = await ensureMeetingMobilePermissions({
        requestNotifications: false,
        requestMicrophone: preferred.audioEnabled,
        requestCamera: preferred.videoEnabled,
      })
      if (!perms.ok) {
        toast.show('Cannot join meeting', {
          tone: 'error',
          message: perms.message,
        })
        return
      }
      const media = meetingJoinMediaFromPermissions(perms, preferred)
      const meeting = await fetchMeetingByCode(normalized)
      if (!meeting) {
        toast.show('Meeting not found', {
          tone: 'error',
          message: 'Please verify the Meeting ID and try again.',
        })
        router.push(coWorkRoutes.meeting(normalized))
        return
      }
      if (meeting.status === 'cancelled') {
        toast.show('Meeting cancelled', {
          tone: 'error',
          message: 'The host cancelled this meeting.',
        })
        return
      }
      openInstantMeetingSession({
        code: meeting.meeting_code,
        meeting,
        autoJoin: true,
        audioEnabled: media.audioEnabled,
        videoEnabled: media.videoEnabled,
        displayName: confirmedName,
      })
      if (!media.audioEnabled) {
        toast.show('Joining without microphone', {
          tone: 'info',
          message: perms.message ?? 'Tap Unmute in the meeting to allow access.',
        })
      }
    } catch (joinError) {
      toast.show('Could not join meeting', {
        tone: 'error',
        message: joinError instanceof Error ? joinError.message : undefined,
      })
      router.push(coWorkRoutes.meeting(normalized))
    } finally {
      setJoining(false)
      setShowJoinModal(false)
      setShowShareModal(false)
    }
  }

  const handleCopyPmi = async () => {
    if (!user) {
      toast.show('Sign in required', {
        tone: 'info',
        message: 'Please sign in to view and copy your Personal Meeting ID.',
      })
      router.push('/auth/sign-in' as never)
      return
    }
    await copyShareLink(buildAppUrl(`/co-work/join?code=${userPmi.replace(/\s/g, '')}`))
    toast.show('PMI Invitation Link Copied', { tone: 'success' })
  }

  const DashboardSplit = wide ? XStack : YStack

  return (
    <PageContent
      scroll
      backgroundColor={ui.pageBg}
      paddingVertical="$5"
      onRefresh={() => setMeetingsRefreshKey((k) => k + 1)}
    >
      <YStack gap="$6" width="100%" {...LAYOUT_STRETCH}>
        {/* Main Dashboard: Split View on Desktop, Column on Mobile */}
        <DashboardSplit
          gap="$6"
          width="100%"
          alignItems={wide ? 'flex-start' : 'stretch'}
        >
          {/* Left Column: The 4 Big SHEconomy Action Tiles */}
          <YStack flex={wide ? 1.2 : undefined} minWidth={0} width="100%" gap="$5">
            {/* The 4 Action Tiles Grid */}
            <YStack
              backgroundColor={ui.surface}
              borderRadius={18}
              borderWidth={1}
              borderColor={ui.borderSoft}
              padding="$5"
              gap="$5"
              style={{
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              }}
            >
              <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3" width="100%">
                {/* 1. New Meeting (SHEconomy Primary Magenta) */}
                <MeetingActionTile
                  label="New Meeting"
                  // Lucide `Video` only renders a stray curve on Android Hermes SVG;
                  // Camera matches the meeting intent and draws cleanly.
                  icon={Icons.Camera}
                  color={SHECONOMY_MEETING_COLORS.primary}
                  hoverColor={SHECONOMY_MEETING_COLORS.primaryHover}
                  busy={creating}
                  onPress={() => setShowStartSheet(true)}
                  hasDropdown
                  onDropdownPress={() => setShowTileDropdown((o) => !o)}
                />

                {/* 2. Join (SHEconomy Coral) */}
                <MeetingActionTile
                  label="Join"
                  icon={Icons.Plus}
                  color={SHECONOMY_MEETING_COLORS.coral}
                  hoverColor={SHECONOMY_MEETING_COLORS.coralHover}
                  onPress={() => setShowJoinModal(true)}
                />

                {/* 3. Schedule (SHEconomy Plum/Berry) */}
                <MeetingActionTile
                  label="Schedule"
                  icon={Icons.Calendar}
                  color={SHECONOMY_MEETING_COLORS.schedule}
                  hoverColor={SHECONOMY_MEETING_COLORS.scheduleHover}
                  onPress={() => {
                    if (!user) {
                      toast.show('Sign in required', {
                        tone: 'info',
                        message: 'Please sign in to schedule a meeting.',
                      })
                      router.push('/auth/sign-in' as never)
                      return
                    }
                    router.push(coWorkRoutes.schedule as never)
                  }}
                />

                {/* 4. Share Screen (brand magenta) */}
                <MeetingActionTile
                  label="Share Screen"
                  icon={Icons.ScreenShare}
                  color={SHECONOMY_MEETING_COLORS.share}
                  hoverColor={SHECONOMY_MEETING_COLORS.shareHover}
                  onPress={() => setShowShareModal(true)}
                />
              </XStack>

              {/* Dropdown Options for New Meeting */}
              {showTileDropdown ? (
                <YStack
                  backgroundColor={ui.surfaceElevated}
                  borderRadius={12}
                  borderWidth={1}
                  borderColor={ui.borderSoft}
                  padding="$3"
                  gap="$2.5"
                >
                  <XStack
                    alignItems="center"
                    gap="$2.5"
                    cursor="pointer"
                    onPress={() => setStartWithVideo((v) => !v)}
                  >
                    <Checkbox
                      checked={startWithVideo}
                      onCheckedChange={(c) => setStartWithVideo(!!c)}
                    />
                    <Text fontSize={13} color={ui.text} fontWeight="500">
                      Start with video
                    </Text>
                  </XStack>

                  <XStack
                    alignItems="center"
                    gap="$2.5"
                    cursor="pointer"
                    onPress={() => setUsePmi((v) => !v)}
                  >
                    <Checkbox checked={usePmi} onCheckedChange={(c) => setUsePmi(!!c)} />
                    <Text fontSize={13} color={ui.text} fontWeight="500">
                      Use my Personal Meeting ID (PMI)
                    </Text>
                  </XStack>
                </YStack>
              ) : null}
            </YStack>

            {/* Quick Join Dialog / Panel */}
            {showJoinModal ? (
              <YStack
                backgroundColor={ui.surface}
                borderRadius={18}
                borderWidth={1}
                borderColor={ui.borderSoft}
                padding="$5"
                gap="$4"
                style={{
                  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.25)',
                }}
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={18} fontWeight="700" color={ui.text}>
                    Join Meeting
                  </Text>
                  <Button
                    tone="ghost"
                    size="$2"
                    circular
                    icon={<Icons.X size={16} color={ui.textSecondary} />}
                    onPress={() => setShowJoinModal(false)}
                  />
                </XStack>

                <YStack gap="$3">
                  <YStack gap="$1.5">
                    <Text fontSize={12} fontWeight="600" color={ui.textSecondary}>
                      Meeting ID or Personal Link Name
                    </Text>
                    <Input
                      value={joinCode}
                      onChangeText={setJoinCode}
                      placeholder="e.g. 849 203 1184"
                      autoCapitalize="characters"
                      backgroundColor={ui.surfaceElevated}
                      borderColor={ui.borderSoft}
                      color={ui.text}
                      placeholderTextColor={ui.textMuted}
                      borderRadius={10}
                      fontSize={15}
                    />
                  </YStack>

                  <YStack gap="$1.5">
                    <Text fontSize={12} fontWeight="600" color={ui.textSecondary}>
                      Your Name
                    </Text>
                    <Input
                      value={joinDisplayName}
                      onChangeText={(value) => {
                        setJoinDisplayName(value)
                        if (joinNameError) setJoinNameError(null)
                      }}
                      placeholder="Enter your name"
                      backgroundColor={ui.surfaceElevated}
                      borderColor={ui.borderSoft}
                      color={ui.text}
                      placeholderTextColor={ui.textMuted}
                      borderRadius={10}
                      fontSize={15}
                    />
                    {joinNameError ? (
                      <Text fontSize={12} color={ui.danger}>
                        {joinNameError}
                      </Text>
                    ) : null}
                  </YStack>

                  <YStack gap="$2" paddingTop="$1">
                    <XStack
                      alignItems="center"
                      gap="$2"
                      cursor="pointer"
                      onPress={() => setDoNotConnectAudio((v) => !v)}
                    >
                      <Checkbox
                        checked={doNotConnectAudio}
                        onCheckedChange={(c) => setDoNotConnectAudio(!!c)}
                      />
                      <Text fontSize={13} color={ui.textSecondary}>
                        Do not connect to audio
                      </Text>
                    </XStack>

                    <XStack
                      alignItems="center"
                      gap="$2"
                      cursor="pointer"
                      onPress={() => setTurnOffVideo((v) => !v)}
                    >
                      <Checkbox
                        checked={turnOffVideo}
                        onCheckedChange={(c) => setTurnOffVideo(!!c)}
                      />
                      <Text fontSize={13} color={ui.textSecondary}>
                        Turn off my video
                      </Text>
                    </XStack>
                  </YStack>

                  <XStack gap="$3" justifyContent="flex-end" paddingTop="$2">
                    <Button
                      tone="outline"
                      borderRadius={10}
                      onPress={() => setShowJoinModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      tone="primary"
                      backgroundColor={ui.brand}
                      borderRadius={10}
                      disabled={!joinCode.trim() || joining}
                      onPress={() => void handleJoin(joinCode)}
                    >
                      {joining ? 'Joining…' : 'Join'}
                    </Button>
                  </XStack>
                </YStack>

                {/* Recent Codes Quick Pills */}
                {recentCodes.length > 0 ? (
                  <YStack gap="$2" paddingTop="$2" borderTopWidth={1} borderTopColor={ui.borderSoft}>
                    <Text fontSize={11} fontWeight="700" color={ui.textMuted} textTransform="uppercase">
                      Recent Meetings
                    </Text>
                    <XStack gap="$2" flexWrap="wrap">
                      {recentCodes.slice(0, 4).map((code) => (
                        <XStack
                          key={code}
                          paddingHorizontal="$3"
                          paddingVertical="$1.5"
                          borderRadius={999}
                          borderWidth={1}
                          borderColor={ui.borderSoft}
                          backgroundColor={ui.surfaceElevated}
                          cursor="pointer"
                          hoverStyle={{ borderColor: ui.brand }}
                          onPress={() => {
                            setJoinCode(code)
                            void handleJoin(code)
                          }}
                        >
                          <Text fontSize={12} fontWeight="600" color={ui.text} letterSpacing={0.5}>
                            {code}
                          </Text>
                        </XStack>
                      ))}
                    </XStack>
                  </YStack>
                ) : null}
              </YStack>
            ) : null}

            {/* Share Screen Quick Modal */}
            {showShareModal ? (
              <YStack
                backgroundColor={ui.surface}
                borderRadius={18}
                borderWidth={1}
                borderColor={ui.borderSoft}
                padding="$5"
                gap="$4"
                style={{
                  boxShadow: '0 8px 28px rgba(0, 0, 0, 0.25)',
                }}
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={18} fontWeight="700" color={ui.text}>
                    Share Screen
                  </Text>
                  <Button
                    tone="ghost"
                    size="$2"
                    circular
                    icon={<Icons.X size={16} color={ui.textSecondary} />}
                    onPress={() => setShowShareModal(false)}
                  />
                </XStack>
                <Text fontSize={13} color={ui.textSecondary}>
                  Enter the Sharing Key or Meeting ID to share directly to a room:
                </Text>
                <Input
                  value={shareCode}
                  onChangeText={setShareCode}
                  placeholder="Sharing Key or Meeting ID"
                  backgroundColor={ui.surfaceElevated}
                  borderColor={ui.borderSoft}
                  color={ui.text}
                  placeholderTextColor={ui.textMuted}
                  borderRadius={10}
                />
                <XStack gap="$3" justifyContent="flex-end">
                  <Button tone="outline" borderRadius={10} onPress={() => setShowShareModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    tone="primary"
                    backgroundColor={SHECONOMY_MEETING_COLORS.share}
                    borderRadius={10}
                    disabled={!shareCode.trim() || joining}
                    onPress={() => void handleJoin(shareCode, true)}
                  >
                    Share Screen
                  </Button>
                </XStack>
              </YStack>
            ) : null}

            {/* Hub Quick Links */}
            <XStack gap="$3" alignItems="center">
              <AppLink href={coWorkRoutes.meetings} asChild>
                <Button tone="outline" size="$3" borderRadius={10} icon={<Icons.Calendar size={16} />}>
                  My Meetings Hub
                </Button>
              </AppLink>
              <AppLink href={coWorkRoutes.schedule} asChild>
                <Button tone="outline" size="$3" borderRadius={10} icon={<Icons.Plus size={16} />}>
                  Schedule Meeting
                </Button>
              </AppLink>
            </XStack>
          </YStack>

          {/* Right Column: Digital Clock & Upcoming Schedule */}
          <YStack flex={wide ? 0.9 : undefined} minWidth={0} width="100%" gap="$4">
            {/* Clock Widget Card */}
            <YStack
              backgroundColor={ui.surface}
              borderRadius={18}
              borderWidth={1}
              borderColor={ui.borderSoft}
              padding="$5"
              justifyContent="center"
              style={{
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              }}
            >
              <MeetingDigitalClock />
            </YStack>

            {/* Personal Meeting ID (PMI) Card */}
            <YStack
              backgroundColor={ui.surface}
              borderRadius={18}
              borderWidth={1}
              borderColor={ui.borderSoft}
              padding="$4"
              gap="$3"
              style={{
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
              }}
            >
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={12} fontWeight="700" color={ui.textSecondary} textTransform="uppercase">
                  Personal Meeting ID (PMI)
                </Text>
                <Button
                  tone="ghost"
                  size="$2"
                  icon={<Icons.Copy size={14} color={ui.brandLight} />}
                  onPress={() => void handleCopyPmi()}
                >
                  Copy Link
                </Button>
              </XStack>
              <Text fontSize={17} fontWeight="800" color={ui.text} letterSpacing={1}>
                {userPmi}
              </Text>
            </YStack>
          </YStack>
        </DashboardSplit>

        {/* Upcoming Meetings & Revisit Section */}
        <IdleMount>
          <YStack gap="$4" paddingTop="$4" borderTopWidth={1} borderTopColor={ui.borderSoft}>
            <UpcomingMeetingsStrip refreshKey={meetingsRefreshKey} />
            <RecentMeetingRevisitStrip />
          </YStack>
        </IdleMount>
      </YStack>
      <MeetingStartSheet
        open={showStartSheet}
        onClose={() => setShowStartSheet(false)}
        pmiCode={userPmi}
        defaultTitle={
          profile?.full_name?.trim() || profile?.username?.trim()
            ? `${profile?.full_name?.trim() || profile?.username?.trim()}'s Meeting`
            : undefined
        }
        onStart={(options) => {
          void startInstantMeeting(options)
        }}
        onStartWhiteboard={() => {
          void startInstantMeeting({ videoOn: false, usePmi: false, whiteboard: true })
        }}
      />
    </PageContent>
  )
}
