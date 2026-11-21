import type { ReactNode } from 'react'
import { useWindowDimensions } from 'react-native'

import { Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

const FORM_ROW_BREAKPOINT = 720
const FORM_LABEL_WIDTH = 180

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
  const { width } = useWindowDimensions()
  const compact = width < FORM_ROW_BREAKPOINT
  return (
    <YStack
      gap="$3.5"
      padding={noPadding ? 0 : compact ? '$3' : '$5'}
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

type ListingFormRowProps = {
  ui: AppUiTokens
  label: string
  required?: boolean
  hint?: string
  error?: string | null
  children: ReactNode
  /** Force stacked label (e.g. inside a dense table cell). */
  stacked?: boolean
}

/** Label above the field, full width on every screen size. */
export function ListingFormRow({
  ui,
  label,
  required,
  hint,
  error,
  children,
}: ListingFormRowProps) {
  const sideBySide = false

  return (
    <YStack gap="$1.5" width="100%">
      <XStack
        width="100%"
        gap={sideBySide ? '$4' : '$1.5'}
        alignItems={sideBySide ? 'flex-start' : 'stretch'}
        flexDirection={sideBySide ? 'row' : 'column'}
      >
        <YStack
          width={sideBySide ? FORM_LABEL_WIDTH : '100%'}
          paddingTop={sideBySide ? 10 : 0}
          flexShrink={0}
          gap={2}
        >
          <Text fontSize={13} fontWeight="600" color={ui.text} lineHeight={18}>
            {label}
            {required ? (
              <Text fontSize={13} fontWeight="700" color={ui.danger}>
                {' '}
                *
              </Text>
            ) : null}
          </Text>
          {hint && !sideBySide ? (
            <Text fontSize={11} color={ui.textMuted} lineHeight={15}>
              {hint}
            </Text>
          ) : null}
        </YStack>
        <YStack flex={1} minWidth={0} gap="$1.5" width={sideBySide ? undefined : '100%'}>
          {children}
          {hint && sideBySide ? (
            <Text fontSize={11} color={ui.textMuted} lineHeight={15}>
              {hint}
            </Text>
          ) : null}
          <ListingPublishFieldError ui={ui} message={error} />
        </YStack>
      </XStack>
    </YStack>
  )
}
