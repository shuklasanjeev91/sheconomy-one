import { useEffect, useState } from 'react'

import { Avatar, Button, Checkbox, Field, Icons, Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { MeetingBackgroundPreview } from '~/co-work/components/MeetingBackgroundPreview'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import {
  loadRememberedMeetingDisplayName,
  normalizeMeetingDisplayName,
  safeMeetingDisplayName,
  saveRememberedMeetingDisplayName,
} from '~/co-work/lib/meeting-display-name'

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
  const safeProfileName = safeMeetingDisplayName(profileName)
  const [displayName, setDisplayName] = useState(safeProfileName)
  const [editing, setEditing] = useState(false)
  const [rememberName, setRememberName] = useState(false)
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

  return (
    <YStack flex={1} width="100%" backgroundColor={coworkUi.pageBg}>
      <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
        <YStack
          width="100%"
          maxWidth={760}
          alignSelf="center"
          padding="$5"
          paddingVertical="$6"
          gap="$5"
        >
          <YStack gap="$2">
            <Text fontSize={26} fontWeight="800" color={coworkUi.text} letterSpacing={-0.4}>
              Join meeting
            </Text>
            <Text color={coworkUi.textSecondary} fontSize={14}>
              {meetingTitle} · {meetingCode}
            </Text>
          </YStack>

          <YStack
            padding="$4"
            gap="$4"
            borderRadius={coworkUi.radius.panel}
            borderWidth={1}
            borderColor={coworkUi.glassBorder}
            style={meetingBarStyle(coworkUi, true)}
          >
            <XStack alignItems="center" gap="$4">
              <Avatar name={displayName || safeProfileName} src={avatarUrl ?? undefined} size="$6" />
              <YStack flex={1} minWidth={0} gap={3}>
                <Text fontSize={18} fontWeight="800" color={coworkUi.text} numberOfLines={1}>
                  {displayName || safeProfileName}
                </Text>
                {email ? (
                  <Text fontSize={13} color={coworkUi.textMuted} numberOfLines={1}>
                    Signed in as {email}
                  </Text>
                ) : (
                  <Text fontSize={13} color={coworkUi.textMuted}>
                    Signed-in SHEconomy account
                  </Text>
                )}
                <Text fontSize={11} color={coworkUi.textMuted}>
                  Your email is shown only to you on this screen.
                </Text>
              </YStack>
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
            ) : (
              <Button
                tone="outline"
                size="$3"
                borderRadius={999}
                alignSelf="flex-start"
                icon={<Icons.Pencil size={15} />}
                onPress={() => setEditing(true)}
              >
                Edit display name
              </Button>
            )}
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

          <MeetingBackgroundPreview userId={userId} />

          <XStack
            alignItems="center"
            justifyContent="center"
            gap="$3"
            flexWrap="wrap"
            paddingVertical="$1"
          >
            <Button
              tone={audioEnabled ? 'outline' : 'primary'}
              size="$3"
              borderRadius={999}
              icon={
                audioEnabled ? (
                  <Icons.Mic size={16} color={coworkUi.text} />
                ) : (
                  <Icons.MicOff size={16} color="white" />
                )
              }
              onPress={() => setAudioEnabled((value) => !value)}
              accessibilityLabel={audioEnabled ? 'Mute microphone before joining' : 'Unmute microphone'}
            >
              {audioEnabled ? 'Mic on' : 'Mic off'}
            </Button>
            <Button
              tone={videoEnabled ? 'outline' : 'primary'}
              size="$3"
              borderRadius={999}
              icon={
                videoEnabled ? (
                  <Icons.Video size={16} color={coworkUi.text} />
                ) : (
                  <Icons.VideoOff size={16} color="white" />
                )
              }
              onPress={() => setVideoEnabled((value) => !value)}
              accessibilityLabel={videoEnabled ? 'Turn camera off before joining' : 'Turn camera on'}
            >
              {videoEnabled ? 'Camera on' : 'Camera off'}
            </Button>
          </XStack>
          <Text fontSize={12} color={coworkUi.textMuted} textAlign="center">
            Your mic and camera preferences carry into the meeting.
          </Text>

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

          <XStack gap="$3" justifyContent="center" flexWrap="wrap">
            <Button
              tone="primary"
              size="$5"
              borderRadius={12}
              disabled={busy || isLocked}
              opacity={busy || isLocked ? 0.55 : 1}
              icon={<Icons.Video size={18} color="white" />}
              onPress={() => void join()}
            >
              {busy ? 'Joining…' : isLocked ? 'Meeting locked' : 'Join'}
            </Button>
            <Button tone="ghost" size="$4" borderRadius={12} disabled={busy} onPress={onBack}>
              Back
            </Button>
          </XStack>
        </YStack>
      </ScrollView>
    </YStack>
  )
}
