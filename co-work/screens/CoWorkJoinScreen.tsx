import { useRouter } from 'one'
import { Platform } from 'react-native'
import { useState } from 'react'

import { AppPage } from '~/components/layout'
import { Button, Icons, Input, Text, XStack, YStack } from '~/components/ui'
import { CoWorkBrandChip, CoWorkIconBadge } from '~/co-work/components/CoWorkUi'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'
import { coWorkRoutes } from '~/lib/routes'

import { BRAND_NAME } from '~/config/brand'

export function CoWorkJoinScreen() {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const router = useRouter()
  const [joinCode, setJoinCode] = useState('')

  return (
    <AppPage
      scroll
      backgroundColor={coworkUi.pageBg}
      paddingVertical="$6"
      style={Platform.OS === 'web' ? { background: coworkGradients.page } : undefined}
    >
      <YStack gap="$5" width="100%" maxWidth={560} alignSelf="center">
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
            ...(Platform.OS === 'web' ? { boxShadow: coworkShadows.card } : {}),
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
          <Button
            tone="primary"
            size="$4"
            borderRadius={999}
            onPress={() => {
              const normalized = joinCode.replace(/\s/g, '').toUpperCase()
              if (!normalized) return
              router.push(coWorkRoutes.meeting(normalized))
            }}
            style={Platform.OS === 'web' ? { backgroundImage: coworkGradients.activeControl } : undefined}
          >
            Join meeting
          </Button>
        </YStack>
      </YStack>
    </AppPage>
  )
}