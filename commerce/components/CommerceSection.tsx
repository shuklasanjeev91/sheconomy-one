import type { ReactNode } from 'react'
import { Link } from 'one'
import type { Href } from 'one'

import { Text, Theme, XStack, YStack } from '~/components/ui'
import { BRAND_THEME } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

type CommerceSectionProps = {
  title: string
  subtitle?: string
  actionLabel?: string
  actionHref?: Href
  children: ReactNode
}

/** Section header for commerce feeds — accent rail, pill action, generous rhythm. */
export function CommerceSection({
  title,
  subtitle,
  actionLabel,
  actionHref,
  children,
}: CommerceSectionProps) {
  const ui = useAppUi()

  return (
    <YStack gap="$4" width="100%">
      <XStack alignItems="flex-end" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <XStack gap="$3" flex={1} alignItems="flex-start" minWidth={0}>
          <YStack
            width={4}
            height={36}
            borderRadius={999}
            backgroundColor={ui.brand}
            marginTop={4}
            opacity={0.9}
          />
          <YStack gap="$1" flex={1} minWidth={0}>
            <Text
              fontWeight="800"
              fontSize={24}
              color={ui.text}
              letterSpacing={-0.5}
              lineHeight={30}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text color={ui.textMuted} fontSize={13} lineHeight={18} fontWeight="500">
                {subtitle}
              </Text>
            ) : null}
          </YStack>
        </XStack>
        {actionLabel && actionHref ? (
          <Link href={actionHref}>
            <Theme name={BRAND_THEME}>
              <XStack
                paddingHorizontal="$3"
                paddingVertical="$1.5"
                borderRadius={999}
                backgroundColor="$color3"
                cursor="pointer"
                animation="quick"
                hoverStyle={{ backgroundColor: '$color4', y: -1 }}
                pressStyle={{ scale: 0.97, y: 0 }}
              >
                <Text color="$color11" fontWeight="600" fontSize={12} letterSpacing={0.15}>
                  {actionLabel}
                </Text>
              </XStack>
            </Theme>
          </Link>
        ) : null}
      </XStack>
      {children}
    </YStack>
  )
}
