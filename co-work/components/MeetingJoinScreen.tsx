import { useEffect, useState } from 'react'

import { Avatar, Button, Field, Icons, Input, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { MeetingBackgroundPreview } from '~/co-work/components/MeetingBackgroundPreview'
import { DevicePrepCard } from '~/co-work/components/DevicePrepCard'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { normalizeMeetingDisplayName, safeMeetingDisplayName } from '~/co-work/lib/meeting-display-name'

type MeetingJoinScreenProps = {
  meetingTitle: string
  meetingCode: string
  profileName: string
  email: string | null
  avatarUrl?: string | null
  onJoin: (displayName: string) => Promise<void>
  onBack: () => void
}

export function MeetingJoinScreen({
  meetingTitle,
  meetingCode,
  profileName,
  email,
  avatarUrl,
  onJoin,
  onBack,
}: MeetingJoinScreenProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const safeProfileName = safeMeetingDisplayName(profileName)
  const [displayName, setDisplayName] = useState(safeProfileName)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!editing) setDisplayName(safeProfileName)
  }, [editing, safeProfileName])

  const join = async () => {
    const confirmedName = normalizeMeetingDisplayName(displayName)
    if (!confirmedName) {
      setError('Enter a valid name. Internal account IDs cannot be used as display names.')
      setEditing(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onJoin(confirmedName.slice(0, 80))
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
            <Text fontSize={30} fontWeight="800" color={coworkUi.text}>
              Join Meeting
            </Text>
            <Text color={coworkUi.textSecondary} fontSize={15}>
              {meetingTitle} · {meetingCode}
            </Text>
          </YStack>

          <YStack
            padding="$5"
            gap="$4"
            borderRadius={22}
            borderWidth={1}
            borderColor={coworkUi.glassBorder}
            style={coworkGlassStyle(coworkUi, true)}
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
          </YStack>

          <MeetingBackgroundPreview />
          <DevicePrepCard />

          {error ? (
            <Text color={coworkUi.danger} textAlign="center">
              {error}
            </Text>
          ) : null}

          <XStack gap="$3" justifyContent="center" flexWrap="wrap">
            <Button
              tone="primary"
              size="$4"
              borderRadius={999}
              disabled={busy}
              icon={<Icons.Video size={18} color="white" />}
              onPress={() => void join()}
            >
              {busy ? 'Joining…' : 'Join Meeting'}
            </Button>
            <Button tone="outline" size="$4" borderRadius={999} disabled={busy} onPress={onBack}>
              Back
            </Button>
          </XStack>
        </YStack>
      </ScrollView>
    </YStack>
  )
}
