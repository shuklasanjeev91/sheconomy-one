import { useRouter } from 'one'
import { useState } from 'react'

import { AppPage, LAYOUT_STRETCH } from '~/components/layout'
import { Button, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import {
  clearRecentMeetingCodes,
  recordMeetingCode,
  useRecentMeetingCodes,
} from '~/co-work/lib/recent-meeting-codes'
import { meetingBarStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { controlGradientStyle, pageGradientStyle } from '~/lib/platform/crossStyles'
import { coWorkRoutes } from '~/lib/routes'

export function CoWorkJoinScreen() {
  const { ui: coworkUi, gradients: coworkGradients } = useCoWorkTheme()
  const router = useRouter()
  const recentCodes = useRecentMeetingCodes()
  const [joinCode, setJoinCode] = useState('')

  function joinWithCode(code: string) {
    const normalized = code.replace(/\s/g, '').toUpperCase()
    if (!normalized) return
    recordMeetingCode(normalized)
    router.push(coWorkRoutes.meeting(normalized))
  }

  return (
    <AppPage
      scroll
      backgroundColor={coworkUi.pageBg}
      paddingVertical="$6"
      style={pageGradientStyle(coworkGradients.page, coworkUi.pageBg)}
    >
      <YStack
        gap="$5"
        width="100%"
        maxWidth={420}
        alignSelf="center"
        {...LAYOUT_STRETCH}
      >
        <YStack gap="$2" alignItems="center">
          <Text fontSize={28} fontWeight="800" color={coworkUi.text} letterSpacing={-0.6} textAlign="center">
            Join a meeting
          </Text>
          <Text color={coworkUi.textSecondary} textAlign="center" fontSize={14}>
            Enter the meeting ID from your invite
          </Text>
        </YStack>

        <YStack
          gap="$4"
          padding="$5"
          borderRadius={coworkUi.radius.panel}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          style={meetingBarStyle(coworkUi, true)}
        >
          <Input
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="ABC DEF GHI"
            autoCapitalize="characters"
            backgroundColor={coworkUi.meetingControl}
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            placeholderTextColor={coworkUi.textMuted}
            borderRadius={12}
            fontSize={22}
            letterSpacing={3}
            textAlign="center"
            height={56}
          />
          <Button
            tone="primary"
            size="$5"
            borderRadius={12}
            icon={<Icons.Video size={18} color="white" />}
            onPress={() => joinWithCode(joinCode)}
            style={controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)}
          >
            Join
          </Button>
        </YStack>

        {recentCodes.length > 0 ? (
          <YStack gap="$2.5">
            <XStack alignItems="center" justifyContent="space-between">
              <Text fontWeight="700" fontSize={13} color={coworkUi.meetingIconMuted}>
                Recent
              </Text>
              <Text
                fontSize={12}
                fontWeight="600"
                color={coworkUi.textMuted}
                cursor="pointer"
                onPress={() => clearRecentMeetingCodes()}
              >
                Clear
              </Text>
            </XStack>
            <XStack gap="$2" flexWrap="wrap" justifyContent="center">
              {recentCodes.map((code) => (
                <XStack
                  key={code}
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={coworkUi.borderSoft}
                  backgroundColor={coworkUi.meetingControl}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.85 }}
                  onPress={() => joinWithCode(code)}
                >
                  <Text fontSize={13} fontWeight="700" color={coworkUi.text} letterSpacing={1}>
                    {code}
                  </Text>
                </XStack>
              ))}
            </XStack>
          </YStack>
        ) : null}
      </YStack>
    </AppPage>
  )
}
