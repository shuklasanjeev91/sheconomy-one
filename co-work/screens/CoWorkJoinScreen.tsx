import { useRouter } from 'one'
import { useEffect, useState } from 'react'

import { AppPage, LAYOUT_STRETCH } from '~/components/layout'
import { Button, Checkbox, Icons, Input, Text, XStack, YStack, useAppToast } from '~/components/ui'
import {
  clearRecentMeetingCodes,
  recordMeetingCode,
  useRecentMeetingCodes,
} from '~/co-work/lib/recent-meeting-codes'
import {
  loadRememberedMeetingDisplayName,
  saveRememberedMeetingDisplayName,
} from '~/co-work/lib/meeting-display-name'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { saveMeetingJoinPrefs, meetingJoinPrefsFromCheckboxes } from '~/co-work/lib/meeting-join-prefs'
import { unlockWebAudioPlayback } from '~/co-work/lib/meeting-web'
import { controlGradientStyle, pageGradientStyle } from '~/lib/platform/crossStyles'
import { coWorkRoutes } from '~/lib/routes'
import { useProfile } from '~/hooks/useProfile'
import { useAppLayout } from '~/hooks/useAppLayout'

export function CoWorkJoinScreen() {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const router = useRouter()
  const toast = useAppToast()
  const { profile, user } = useProfile()
  const { isDesktop, isTablet } = useAppLayout()
  const wide = isDesktop || isTablet
  const recentCodes = useRecentMeetingCodes()

  const [joinCode, setJoinCode] = useState('')
  const [displayName, setDisplayName] = useState(
    () => profile?.full_name?.trim() || profile?.username?.trim() || '',
  )
  const [rememberName, setRememberName] = useState(true)
  const [doNotConnectAudio, setDoNotConnectAudio] = useState(false)
  const [turnOffVideo, setTurnOffVideo] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadRememberedMeetingDisplayName().then((saved) => {
      if (!cancelled && saved) {
        setDisplayName(saved)
      } else if (!cancelled && (profile?.full_name || profile?.username)) {
        setDisplayName(profile.full_name || profile.username || '')
      }
    })
    return () => {
      cancelled = true
    }
  }, [profile])

  async function handleJoin(codeToJoin: string) {
    const normalized = codeToJoin.replace(/\s/g, '').toUpperCase()
    if (!normalized) {
      toast.show('Please enter a Meeting ID', { tone: 'info' })
      return
    }

    if (rememberName && displayName.trim()) {
      await saveRememberedMeetingDisplayName(displayName.trim())
    }

    const media = meetingJoinPrefsFromCheckboxes({ doNotConnectAudio, turnOffVideo })
    saveMeetingJoinPrefs({
      ...media,
      displayName: displayName.trim() || undefined,
    })
    unlockWebAudioPlayback()

    recordMeetingCode(normalized)
    router.push(coWorkRoutes.meeting(normalized))
  }

  return (
    <AppPage
      scroll
      backgroundColor="#0c080a"
      paddingVertical="$6"
      style={pageGradientStyle(coworkGradients.page, '#0c080a')}
    >
      <YStack
        gap="$5"
        width="100%"
        maxWidth="100%"
        alignSelf="stretch"
        {...LAYOUT_STRETCH}
      >
        {/* Zoom Join Window Card */}
        <XStack
          width="100%"
          gap="$5"
          flexWrap={wide ? 'nowrap' : 'wrap'}
          alignItems="flex-start"
        >
        <YStack
          flexGrow={1}
          flexShrink={1}
          flexBasis={wide ? '0%' : '100%'}
          width={wide ? undefined : '100%'}
          minWidth={0}
          gap="$4"
          padding={wide ? '$6' : '$5'}
          borderRadius={20}
          borderWidth={1}
          borderColor="rgba(255, 255, 255, 0.12)"
          backgroundColor="rgba(22, 18, 24, 0.96)"
          style={{
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7)',
          }}
        >
          {/* Header */}
          <XStack alignItems="center" justifyContent="space-between" paddingBottom="$1">
            <Text fontSize={20} fontWeight="800" color="#ffffff" letterSpacing={-0.3}>
              Join a Meeting
            </Text>
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

          {/* Form Fields */}
          <YStack gap="$3.5">
            <YStack gap="$1.5">
              <Text fontSize={12} fontWeight="700" color={coworkUi.textSecondary}>
                Meeting ID or Personal Link Name
              </Text>
              <Input
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="Enter Meeting ID"
                autoCapitalize="characters"
                backgroundColor="rgba(0, 0, 0, 0.5)"
                borderColor={coworkUi.borderSoft}
                color="#ffffff"
                placeholderTextColor={coworkUi.textMuted}
                borderRadius={10}
                fontSize={16}
                height={48}
              />
            </YStack>

            <YStack gap="$1.5">
              <Text fontSize={12} fontWeight="700" color={coworkUi.textSecondary}>
                Your Name
              </Text>
              <Input
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                backgroundColor="rgba(0, 0, 0, 0.5)"
                borderColor={coworkUi.borderSoft}
                color="#ffffff"
                placeholderTextColor={coworkUi.textMuted}
                borderRadius={10}
                fontSize={16}
                height={48}
              />
            </YStack>

            {/* Checkboxes (Zoom-style) */}
            <YStack gap="$2.5" paddingTop="$2">
              <XStack alignItems="center" gap="$2.5" cursor="pointer" onPress={() => setRememberName((v) => !v)}>
                <Checkbox checked={rememberName} onCheckedChange={(c) => setRememberName(Boolean(c))} />
                <Text fontSize={13} color={coworkUi.textSecondary}>
                  Remember my name for future meetings
                </Text>
              </XStack>

              <XStack alignItems="center" gap="$2.5" cursor="pointer" onPress={() => setDoNotConnectAudio((v) => !v)}>
                <Checkbox checked={doNotConnectAudio} onCheckedChange={(c) => setDoNotConnectAudio(Boolean(c))} />
                <Text fontSize={13} color={coworkUi.textSecondary}>
                  Do not connect to audio
                </Text>
              </XStack>

              <XStack alignItems="center" gap="$2.5" cursor="pointer" onPress={() => setTurnOffVideo((v) => !v)}>
                <Checkbox checked={turnOffVideo} onCheckedChange={(c) => setTurnOffVideo(Boolean(c))} />
                <Text fontSize={13} color={coworkUi.textSecondary}>
                  Turn off my video
                </Text>
              </XStack>
            </YStack>

            {/* Action Buttons */}
            <XStack gap="$3" paddingTop="$3" width="100%" alignItems="stretch">
              <Button
                flexGrow={1}
                flexShrink={0}
                flexBasis="0%"
                height={48}
                minHeight={48}
                tone="primary"
                size="$5"
                borderRadius={10}
                disabled={!joinCode.trim()}
                opacity={!joinCode.trim() ? 0.5 : 1}
                icon={<Icons.Video size={18} color="#fff" />}
                onPress={() => handleJoin(joinCode)}
                style={{
                  ...controlGradientStyle(coworkGradients.activeControl, coworkUi.brand),
                  height: 48,
                  minHeight: 48,
                }}
              >
                Join
              </Button>

              <Button
                height={48}
                minHeight={48}
                flexShrink={0}
                tone="outline"
                size="$5"
                borderRadius={10}
                borderColor="rgba(255, 255, 255, 0.16)"
                backgroundColor="rgba(255, 255, 255, 0.04)"
                onPress={() => router.push(coWorkRoutes.home as never)}
              >
                Cancel
              </Button>
            </XStack>
          </YStack>

          {/* Recent Meeting Codes — under the form on mobile/tablet */}
          {!wide && recentCodes.length > 0 ? (
            <YStack gap="$2.5" paddingTop="$3" borderTopWidth={1} borderColor="rgba(255, 255, 255, 0.08)">
              <XStack alignItems="center" justifyContent="space-between">
                <Text fontWeight="700" fontSize={12} color={coworkUi.meetingIconMuted}>
                  Recent Meetings
                </Text>
                <Text
                  fontSize={11}
                  fontWeight="600"
                  color={coworkUi.brandLight}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.7 }}
                  onPress={() => clearRecentMeetingCodes()}
                >
                  Clear history
                </Text>
              </XStack>
              <XStack gap="$2" flexWrap="wrap">
                {recentCodes.map((code) => (
                  <XStack
                    key={code}
                    paddingHorizontal="$3"
                    paddingVertical="$1.5"
                    borderRadius={8}
                    borderWidth={1}
                    borderColor="rgba(255, 255, 255, 0.12)"
                    backgroundColor="rgba(255, 255, 255, 0.04)"
                    cursor="pointer"
                    pressStyle={{ opacity: 0.8 }}
                    onPress={() => {
                      setJoinCode(code)
                      void handleJoin(code)
                    }}
                  >
                    <Text fontSize={12} fontWeight="700" color="#ffffff" letterSpacing={0.5}>
                      {code}
                    </Text>
                  </XStack>
                ))}
              </XStack>
            </YStack>
          ) : null}
        </YStack>

        {wide ? (
          <YStack
            flexGrow={1}
            flexShrink={1}
            flexBasis="0%"
            minWidth={0}
            gap="$4"
            padding="$6"
            borderRadius={20}
            borderWidth={1}
            borderColor="rgba(255, 255, 255, 0.12)"
            backgroundColor="rgba(22, 18, 24, 0.96)"
          >
            <YStack gap="$2">
              <Text fontSize={20} fontWeight="800" color="#ffffff">
                Join from any device
              </Text>
              <Text fontSize={14} color={coworkUi.textSecondary} lineHeight={21}>
                Enter a meeting ID or pick a recent meeting. Your camera and mic preferences apply when you enter the lobby.
              </Text>
            </YStack>
            {recentCodes.length > 0 ? (
              <YStack gap="$2.5">
                <XStack alignItems="center" justifyContent="space-between">
                  <Text fontWeight="700" fontSize={12} color={coworkUi.meetingIconMuted}>
                    Recent Meetings
                  </Text>
                  <Text
                    fontSize={11}
                    fontWeight="600"
                    color={coworkUi.brandLight}
                    cursor="pointer"
                    pressStyle={{ opacity: 0.7 }}
                    onPress={() => clearRecentMeetingCodes()}
                  >
                    Clear history
                  </Text>
                </XStack>
                <XStack gap="$2" flexWrap="wrap">
                  {recentCodes.map((code) => (
                    <XStack
                      key={code}
                      paddingHorizontal="$3"
                      paddingVertical="$1.5"
                      borderRadius={8}
                      borderWidth={1}
                      borderColor="rgba(255, 255, 255, 0.12)"
                      backgroundColor="rgba(255, 255, 255, 0.04)"
                      cursor="pointer"
                      pressStyle={{ opacity: 0.8 }}
                      onPress={() => {
                        setJoinCode(code)
                        void handleJoin(code)
                      }}
                    >
                      <Text fontSize={12} fontWeight="700" color="#ffffff" letterSpacing={0.5}>
                        {code}
                      </Text>
                    </XStack>
                  ))}
                </XStack>
              </YStack>
            ) : (
              <Text fontSize={13} color={coworkUi.textMuted}>
                Recent meeting IDs will show up here after you join.
              </Text>
            )}
          </YStack>
        ) : null}
        </XStack>
      </YStack>
    </AppPage>
  )
}
