import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'

import { Avatar, Button, Checkbox, Field, Icons, Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { MeetingBackgroundPreview } from '~/co-work/components/MeetingBackgroundPreview'
import { useAppLayout } from '~/hooks/useAppLayout'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import {
  loadRememberedMeetingDisplayName,
  normalizeMeetingDisplayName,
  safeMeetingDisplayName,
  saveRememberedMeetingDisplayName,
} from '~/co-work/lib/meeting-display-name'
import {
  loadAlwaysShowJoinPreview,
  saveAlwaysShowJoinPreview,
} from '~/co-work/lib/meeting-join-preview-pref'

type MeetingJoinScreenProps = {
  meetingTitle: string
  meetingCode: string
  profileName: string
  email: string | null
  avatarUrl?: string | null
  userId?: string | null
  requirePasscode?: boolean
  isLocked?: boolean
  lockedMessage?: string
  onJoin: (
    displayName: string,
    passcode?: string,
    options?: { audioEnabled?: boolean; videoEnabled?: boolean },
  ) => Promise<void>
  onBack: () => void
}

export function MeetingJoinScreen({
  meetingTitle,
  meetingCode,
  profileName,
  email,
  avatarUrl,
  userId,
  requirePasscode = false,
  isLocked = false,
  lockedMessage,
  onJoin,
  onBack,
}: MeetingJoinScreenProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const { isTablet, isDesktop } = useAppLayout()
  const centered = isTablet || isDesktop
  const safeProfileName = safeMeetingDisplayName(profileName)
  const [displayName, setDisplayName] = useState(safeProfileName)
  const [editing, setEditing] = useState(false)
  const [rememberName, setRememberName] = useState(false)
  const [alwaysShowPreview, setAlwaysShowPreview] = useState(true)
  const [passcode, setPasscode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)

  useEffect(() => {
    if (!editing && !rememberName) setDisplayName(safeProfileName)
  }, [editing, rememberName, safeProfileName])

  useEffect(() => {
    let cancelled = false
    void loadRememberedMeetingDisplayName().then((remembered) => {
      if (!cancelled && remembered) {
        setDisplayName(remembered)
        setRememberName(true)
      }
    })
    void loadAlwaysShowJoinPreview().then((value) => {
      if (!cancelled) setAlwaysShowPreview(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const join = async () => {
    if (isLocked) {
      setError(lockedMessage || 'This meeting is locked.')
      return
    }
    const confirmedName = normalizeMeetingDisplayName(displayName)
    if (!confirmedName) {
      setError('Enter a valid name. Internal account IDs cannot be used as display names.')
      setEditing(true)
      return
    }
    if (requirePasscode && !passcode.trim()) {
      setError('Enter the meeting passcode to join.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await saveRememberedMeetingDisplayName(rememberName ? confirmedName : null)
      await saveAlwaysShowJoinPreview(alwaysShowPreview)
      await onJoin(confirmedName.slice(0, 80), requirePasscode ? passcode.trim() : undefined, {
        audioEnabled,
        videoEnabled,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not join the meeting.')
    } finally {
      setBusy(false)
    }
  }

  const body = (
    <YStack
      width="100%"
      maxWidth={centered ? 520 : '100%'}
      alignSelf="center"
      padding="$4"
      paddingVertical={centered ? '$4' : '$5'}
      gap="$4"
      backgroundColor={centered ? 'rgba(16, 7, 13, 0.98)' : undefined}
      borderRadius={centered ? 18 : 0}
      borderWidth={centered ? 1 : 0}
      borderColor={centered ? 'rgba(255,255,255,0.12)' : undefined}
      style={centered ? { boxShadow: '0 24px 64px rgba(0,0,0,0.45)' } : undefined}
    >
      <XStack alignItems="center" justifyContent="space-between">
        <Pressable onPress={onBack} accessibilityLabel="Close join preview" hitSlop={10}>
          {centered ? (
            <Text color={coworkUi.brandLight} fontSize={15} fontWeight="700">
              Cancel
            </Text>
          ) : (
            <YStack
              width={36}
              height={36}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(255,255,255,0.08)"
            >
              <Icons.X size={18} color="#fff" />
            </YStack>
          )}
        </Pressable>
        {!centered ? (
          <Text color={coworkUi.textMuted} fontSize={12} fontWeight="700">
            Join preview
          </Text>
        ) : (
          <YStack width={48} />
        )}
        <YStack width={48} />
      </XStack>

      <YStack
        borderRadius={18}
        overflow="hidden"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.12)"
        backgroundColor="#0a0a0c"
      >
        <MeetingBackgroundPreview userId={userId} />
        <XStack
          position="absolute"
          left={0}
          right={0}
          bottom={16}
          alignItems="center"
          justifyContent="center"
          gap="$4"
          zIndex={20}
        >
          <Pressable
            onPress={() => setAudioEnabled((value) => !value)}
            accessibilityLabel={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: audioEnabled ? 'rgba(0,0,0,0.55)' : coworkUi.danger,
            }}
          >
            {audioEnabled ? (
              <Icons.Mic size={22} color="#fff" />
            ) : (
              <Icons.MicOff size={22} color="#fff" />
            )}
          </Pressable>
          <Pressable
            onPress={() => setVideoEnabled((value) => !value)}
            accessibilityLabel={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: videoEnabled ? 'rgba(0,0,0,0.55)' : coworkUi.danger,
            }}
          >
            {videoEnabled ? (
              <Icons.Video size={22} color="#fff" />
            ) : (
              <Icons.VideoOff size={22} color="#fff" />
            )}
          </Pressable>
        </XStack>
      </YStack>

      <YStack gap="$1.5" alignItems="center">
        <Text fontSize={18} fontWeight="800" color="#fff" textAlign="center" letterSpacing={-0.3}>
          {meetingTitle}
        </Text>
        <Text color={coworkUi.textMuted} fontSize={13} textAlign="center">
          Meeting ID · {meetingCode}
        </Text>
      </YStack>

      {!centered ? (
        <YStack
          padding="$3.5"
          gap="$3"
          borderRadius={coworkUi.radius.panel}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          style={meetingBarStyle(coworkUi, true)}
        >
          <XStack alignItems="center" gap="$3">
            <Avatar name={displayName || safeProfileName} src={avatarUrl ?? undefined} size="$5" />
            <YStack flex={1} minWidth={0} gap={2}>
              <Text fontSize={15} fontWeight="800" color={coworkUi.text} numberOfLines={1}>
                {displayName || safeProfileName}
              </Text>
              {email ? (
                <Text fontSize={12} color={coworkUi.textMuted} numberOfLines={1}>
                  {email}
                </Text>
              ) : null}
            </YStack>
            <Button
              tone="ghost"
              size="$2"
              borderRadius={999}
              icon={<Icons.Pencil size={14} color={coworkUi.brandLight} />}
              onPress={() => setEditing((value) => !value)}
            >
              Edit
            </Button>
          </XStack>

          {editing ? (
            <Field label="Display Name">
              <Input
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                autoFocus
                maxLength={80}
                backgroundColor="rgba(255,255,255,0.05)"
                borderColor={coworkUi.borderSoft}
                color={coworkUi.text}
                borderRadius={14}
                onSubmitEditing={() => setEditing(false)}
              />
            </Field>
          ) : null}
          <XStack alignItems="center" gap="$3">
            <Checkbox
              checked={rememberName}
              onCheckedChange={(checked) => setRememberName(checked === true)}
              aria-label="Remember this display name for future meetings"
            />
            <Text
              color={coworkUi.textSecondary}
              fontSize={13}
              onPress={() => setRememberName((value) => !value)}
            >
              Remember for future meetings
            </Text>
          </XStack>
        </YStack>
      ) : null}

      {isLocked ? (
        <YStack
          padding="$4"
          borderRadius={14}
          borderWidth={1}
          borderColor="rgba(244,63,104,0.35)"
          backgroundColor={coworkUi.dangerMuted}
          gap="$2"
        >
          <Text fontWeight="800" color={coworkUi.danger}>
            Meeting locked
          </Text>
          <Text color={coworkUi.textSecondary} fontSize={13} lineHeight={18}>
            {lockedMessage || 'New participants cannot join until the host unlocks the meeting.'}
          </Text>
        </YStack>
      ) : null}

      {requirePasscode && !isLocked ? (
        <Field label="Passcode">
          <Input
            value={passcode}
            onChangeText={setPasscode}
            secureTextEntry
            placeholder="Enter meeting passcode"
            backgroundColor="rgba(255,255,255,0.05)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            borderRadius={14}
          />
        </Field>
      ) : null}

      {error ? (
        <Text color={coworkUi.danger} textAlign="center">
          {error}
        </Text>
      ) : null}

      <Button
        tone="primary"
        size="$5"
        borderRadius={12}
        width="100%"
        minHeight={52}
        height={52}
        disabled={busy || isLocked}
        opacity={busy || isLocked ? 0.55 : 1}
        backgroundColor={coworkUi.brand}
        onPress={() => void join()}
      >
        {busy ? 'Joining…' : isLocked ? 'Meeting locked' : 'Start'}
      </Button>

      <XStack alignItems="center" gap="$3" justifyContent="center">
        <Checkbox
          checked={alwaysShowPreview}
          onCheckedChange={(checked) => setAlwaysShowPreview(checked === true)}
          aria-label="Always show this preview when joining"
        />
        <Text
          color={coworkUi.textSecondary}
          fontSize={13}
          onPress={() => setAlwaysShowPreview((value) => !value)}
        >
          Always show this preview when joining
        </Text>
      </XStack>
    </YStack>
  )

  return (
    <YStack
      flex={1}
      width="100%"
      backgroundColor={centered ? 'rgba(0,0,0,0.55)' : '#10070D'}
      alignItems={centered ? 'center' : 'stretch'}
      justifyContent={centered ? 'center' : 'flex-start'}
      paddingHorizontal={centered ? 24 : 0}
    >
      <ScrollView
        flex={1}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: centered ? 'center' : 'flex-start',
        }}
      >
        {body}
      </ScrollView>
    </YStack>
  )
}
