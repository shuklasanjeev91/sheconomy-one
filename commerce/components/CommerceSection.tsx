import type { ReactNode } from 'react'

import type { Href } from 'one'

import { AppLink } from '~/components/navigation/AppLink'
import { Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type CommerceSectionProps = {
  title: string
  subtitle?: string
  actionLabel?: string
  actionHref?: Href
  /** Custom header action (overrides actionLabel/actionHref when set). */
  action?: ReactNode
  children: ReactNode
}

/** Section header for commerce feeds — marketplace rhythm without dense accent rails. */
export function CommerceSection({
  title,
  subtitle,
  actionLabel,
  actionHref,
  action,
  children,
}: CommerceSectionProps) {
  const ui = useAppUi()

  return (
    <YStack gap="$4" width="100%">
      <XStack alignItems="flex-end" justifyContent="space-between" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minWidth={0}>
          <Text
            fontWeight="800"
            fontSize={22}
            color={ui.text}
            letterSpacing={-0.45}
            lineHeight={28}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text color={ui.textMuted} fontSize={13} lineHeight={18} fontWeight="500">
              {subtitle}
            </Text>
          ) : null}
        </YStack>
        {action ? (
          action
        ) : actionLabel && actionHref ? (
          <AppLink href={actionHref} asChild>
            <Text
              color={ui.link}
              fontWeight="700"
              fontSize={13}
              cursor="pointer"
              hoverStyle={{ color: ui.brand }}
            >
              {actionLabel}
            </Text>
          </AppLink>
        ) : null}
      </XStack>
      {children}
    </YStack>
  )
}
