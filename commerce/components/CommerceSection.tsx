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

/** Section header for commerce home rows — title left, text link right. */
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
      <XStack alignItems="baseline" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1}>
          <Text
            fontWeight="500"
            fontSize={22}
            color={ui.text}
            letterSpacing={-0.3}
            lineHeight={28}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text color={ui.textMuted} fontSize={13} lineHeight={18}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
        {actionLabel && actionHref ? (
          <Link href={actionHref}>
            <Theme name={BRAND_THEME}>
              <Text
                color="$color9"
                fontWeight="500"
                fontSize={13}
                cursor="pointer"
                textDecorationLine="underline"
                hoverStyle={{ color: '$color10' }}
              >
                {actionLabel}
              </Text>
            </Theme>
          </Link>
        ) : null}
      </XStack>
      {children}
    </YStack>
  )
}