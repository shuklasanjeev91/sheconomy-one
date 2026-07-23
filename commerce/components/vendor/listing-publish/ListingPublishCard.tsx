import type { ReactNode } from 'react'

import { Text, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type ListingPublishCardProps = {
  ui: AppUiTokens
  title?: string
  titleAccent?: boolean
  headerRight?: ReactNode
  children: ReactNode
  noPadding?: boolean
}

/** White rounded card used across every wizard step. */
export function ListingPublishCard({
  ui,
  title,
  titleAccent,
  headerRight,
  children,
  noPadding,
}: ListingPublishCardProps) {
  return (
    <YStack
      gap="$3.5"
      padding={noPadding ? 0 : '$5'}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      {title ? (
        <YStack
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          gap="$2"
          paddingHorizontal={noPadding ? '$5' : 0}
          paddingTop={noPadding ? '$5' : 0}
        >
          <Text
            fontSize={15}
            fontWeight="800"
            color={titleAccent ? ui.brand : ui.text}
            letterSpacing={-0.2}
          >
            {title}
          </Text>
          {headerRight}
        </YStack>
      ) : null}
      <YStack paddingHorizontal={noPadding ? '$5' : 0} paddingBottom={noPadding ? '$5' : 0} gap="$3.5">
        {children}
      </YStack>
    </YStack>
  )
}

type ListingPublishTipProps = {
  ui: AppUiTokens
  title: string
  body: string
  solid?: boolean
}

export function ListingPublishTip({ ui, title, body, solid }: ListingPublishTipProps) {
  return (
    <YStack
      gap="$2"
      padding="$4"
      borderRadius={radius.card}
      backgroundColor={solid ? ui.brand : ui.roseSurface}
      borderWidth={solid ? 0 : 1}
      borderColor={ui.borderSubtle}
    >
      <Text fontSize={13} fontWeight="800" color={solid ? 'white' : ui.brand} letterSpacing={0.3}>
        {title}
      </Text>
      <Text fontSize={13} color={solid ? 'rgba(255,255,255,0.92)' : ui.textSecondary} lineHeight={20}>
        {body}
      </Text>
    </YStack>
  )
}

type ListingPublishFieldErrorProps = {
  ui: AppUiTokens
  message?: string | null
}

export function ListingPublishFieldError({ ui, message }: ListingPublishFieldErrorProps) {
  if (!message) return null
  return (
    <Text fontSize={12} color={ui.danger} fontWeight="600">
      {message}
    </Text>
  )
}
