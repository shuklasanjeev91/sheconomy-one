import type { ReactNode } from 'react'
import { YStack } from 'tamagui'
import { Text } from '~/components/ui/Text'

import { Button } from '~/components/ui/Button'
import { Spinner } from '~/components/ui/Spinner'
import { useAppUi } from '~/lib/theme/useAppUi'

type ScreenStateProps = {
  loading?: boolean
  error?: string | null
  empty?: boolean
  /** When true and data exists, show a non-blocking “saved results” hint. */
  showingCached?: boolean
  emptyTitle?: string
  emptyMessage?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
  errorTitle?: string
  onRetry?: () => void
  children?: ReactNode
  minHeight?: number | string
  /**
   * Fill the parent flex column (FlashList hosts). Leave false inside document
   * ScrollViews — `flex:1` there collapses content to a blank screen.
   */
  fill?: boolean
}

/**
 * Consistent loading / empty / error chrome for list and detail screens.
 */
export function ScreenState({
  loading,
  error,
  empty,
  showingCached,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  errorTitle = 'Couldn’t load this',
  onRetry,
  children,
  minHeight = 220,
  fill = false,
}: ScreenStateProps) {
  const ui = useAppUi()

  if (loading) {
    return (
      <YStack
        alignItems="center"
        justifyContent="center"
        paddingVertical="$8"
        gap="$3"
        minHeight={minHeight}
        accessibilityLabel="Loading"
        accessibilityRole="progressbar"
      >
        <Spinner size="large" color={ui.brand} />
        <Text fontSize={13} color={ui.textMuted}>
          Loading…
        </Text>
      </YStack>
    )
  }

  if (error && empty) {
    return (
      <YStack
        alignItems="center"
        justifyContent="center"
        paddingVertical="$8"
        paddingHorizontal="$4"
        gap="$3"
        minHeight={minHeight}
      >
        <Text fontSize={17} fontWeight="700" color={ui.text} textAlign="center">
          {errorTitle}
        </Text>
        <Text fontSize={14} color={ui.textMuted} textAlign="center" maxWidth={360}>
          {error}
        </Text>
        {onRetry ? (
          <Button
            size="$3"
            theme="active"
            borderRadius={999}
            onPress={onRetry}
            accessibilityLabel="Retry"
          >
            Try again
          </Button>
        ) : null}
      </YStack>
    )
  }

  if (empty) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
        minHeight={minHeight}
      />
    )
  }

  return (
    <YStack
      flex={fill ? 1 : undefined}
      minHeight={fill ? 0 : undefined}
      gap="$2"
      width="100%"
      style={fill ? { minHeight: 0 } : undefined}
    >
      {showingCached ? (
        <Text
          fontSize={12}
          color={ui.textMuted}
          textAlign="center"
          accessibilityLiveRegion="polite"
        >
          Showing saved results
        </Text>
      ) : null}
      {error && onRetry ? (
        <YStack
          padding="$3"
          borderRadius="$4"
          backgroundColor={ui.surface}
          borderWidth={1}
          borderColor={ui.border}
          gap="$2"
          marginHorizontal="$2"
        >
          <Text fontSize={13} color={ui.textMuted}>
            {error} — you can keep browsing saved results.
          </Text>
          <Button size="$2" tone="ghost" onPress={onRetry} alignSelf="flex-start">
            Retry
          </Button>
        </YStack>
      ) : null}
      {children}
    </YStack>
  )
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  minHeight = 200,
  icon,
}: {
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  minHeight?: number | string
  icon?: ReactNode
}) {
  const ui = useAppUi()

  return (
    <YStack
      alignItems="center"
      justifyContent="center"
      paddingVertical="$8"
      paddingHorizontal="$4"
      gap="$3"
      minHeight={minHeight}
    >
      {icon}
      <Text fontSize={17} fontWeight="700" color={ui.text} textAlign="center">
        {title}
      </Text>
      {message ? (
        <Text fontSize={14} color={ui.textMuted} textAlign="center" maxWidth={360} lineHeight={20}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          size="$3"
          theme="active"
          borderRadius={999}
          onPress={onAction}
          accessibilityLabel={actionLabel}
          minHeight={44}
          minWidth={44}
        >
          {actionLabel}
        </Button>
      ) : null}
    </YStack>
  )
}
