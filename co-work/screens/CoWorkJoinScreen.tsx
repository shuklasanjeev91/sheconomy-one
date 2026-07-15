import { useRouter } from 'one'
import { useState } from 'react'

import { AppPage, LAYOUT_STRETCH } from '~/components/layout'
import { Button, Icons, Input, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkBrandChip, CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
import { DevicePrepCard } from '~/co-work/components/DevicePrepCard'
import {
  clearRecentMeetingCodes,
  recordMeetingCode,
  useRecentMeetingCodes,
} from '~/co-work/lib/recent-meeting-codes'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { readFromClipboard } from '~/lib/platform/clipboard'
import { controlGradientStyle, coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import { coWorkRoutes } from '~/lib/routes'

import { BRAND_NAME } from '~/config/brand'

export function CoWorkJoinScreen() {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const router = useRouter()
  const toast = useAppToast()
  const recentCodes = useRecentMeetingCodes()
  const [joinCode, setJoinCode] = useState('')

  async function pasteCode() {
    const text = await readFromClipboard()
    if (!text) {
      toast.show('Clipboard is empty', { tone: 'info' })
      return
    }
    const normalized = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    if (!normalized) {
      toast.show('No meeting code found', { tone: 'danger' })
      return
    }
    setJoinCode(normalized)
    toast.show('Code pasted', { tone: 'success' })
  }

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
      <YStack gap="$5" width="100%" {...LAYOUT_STRETCH}>
        <YStack gap="$3">
          <CoWorkBrandChip label="JOIN" />
          <Text fontSize={30} fontWeight="800" color={coworkUi.text} letterSpacing={-0.8}>
            Enter meeting code
          </Text>
          <Text color={coworkUi.textSecondary} lineHeight={22}>
            Join a Co-Work room hosted on {BRAND_NAME}
          </Text>
        </YStack>

        <YStack
          gap="$4"
          padding="$5"
          borderRadius={coworkUi.radius.card}
          borderWidth={1}
          borderColor={coworkUi.glassBorder}
          style={{
            ...coworkGlassStyle(coworkUi, true),
            ...coworkBoxShadow(coworkShadows, 'card'),
          }}
        >
          <XStack alignItems="center" gap="$3">
            <CoWorkIconBadge icon={Icons.Hash} />
            <Text fontWeight="700" color={coworkUi.text}>
              Meeting code
            </Text>
          </XStack>
          <Input
            value={joinCode}
            onChangeText={setJoinCode}
            placeholder="ABC DEF GHI"
            autoCapitalize="characters"
            backgroundColor="rgba(255,255,255,0.05)"
            borderColor={coworkUi.borderSoft}
            color={coworkUi.text}
            placeholderTextColor={coworkUi.textMuted}
            borderRadius={14}
            fontSize={20}
            letterSpacing={2}
            textAlign="center"
          />
          <XStack gap="$2" flexWrap="wrap">
            <Button
              tone="outline"
              size="$3"
              borderRadius={999}
              icon={<Icons.Copy size={16} />}
              onPress={() => void pasteCode()}
            >
              Paste code
            </Button>
            <Button
              tone="primary"
              size="$4"
              borderRadius={999}
              flex={1}
              minWidth={160}
              onPress={() => joinWithCode(joinCode)}
              style={controlGradientStyle(coworkGradients.activeControl, coworkUi.brand)}
            >
              Join meeting
            </Button>
          </XStack>
          <Text fontSize={12} color={coworkUi.textMuted} textAlign="center" lineHeight={18}>
            Codes are case-insensitive. Spaces are optional.
          </Text>
        </YStack>

        {recentCodes.length > 0 ? (
          <YStack
            gap="$3"
            padding="$4"
            borderRadius={coworkUi.radius.card}
            borderWidth={1}
            borderColor={coworkUi.glassBorder}
            style={coworkGlassStyle(coworkUi, true)}
          >
            <XStack alignItems="center" justifyContent="space-between" gap="$2">
              <Text fontWeight="700" fontSize={14} color={coworkUi.text}>
                Recent codes
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
            <XStack gap="$2" flexWrap="wrap">
              {recentCodes.map((code) => (
                <XStack
                  key={code}
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius={999}
                  borderWidth={1}
                  borderColor={coworkUi.borderSoft}
                  backgroundColor="rgba(255,255,255,0.04)"
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

        <DevicePrepCard />

        <YStack gap="$2" paddingHorizontal="$1">
          <Text fontWeight="700" fontSize={14} color={coworkUi.textSecondary}>
            Tips
          </Text>
          <Text fontSize={13} color={coworkUi.textMuted} lineHeight={20}>
            Ask your host for the meeting code, or open an invite link from email or chat.
          </Text>
        </YStack>
      </YStack>
    </AppPage>
  )
}
