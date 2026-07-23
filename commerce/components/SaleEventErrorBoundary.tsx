import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { Button, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'
import { toFriendlySaleError } from '~/lib/sale-event/sale-event.errors'

type Props = {
  children: ReactNode
  /** Optional label for crash reports (e.g. "AdminSaleEvents"). */
  scope?: string
  /** Called when the user taps "Try again" — refetch / reset sale state here. */
  onReset?: () => void
  /** Heading shown above the friendly error message. */
  title?: string
}

type State = {
  error: Error | null
}

/**
 * Error boundary for sale-event screens (admin management + vendor enrollment).
 * Any render error thrown inside a sale flow is caught here, logged, and surfaced
 * through the centralised `toFriendlySaleError` mapper so the user always sees a
 * meaningful message instead of a raw stack / Postgres code.
 */
export class SaleEventErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled sale error', {
      scope: this.props.scope ?? 'sale',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      platform: Platform.OS,
    })
  }

  private handleRetry = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = toFriendlySaleError(this.state.error)

    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        padding="$6"
        gap="$4"
        backgroundColor="$background"
        minHeight={Platform.OS === 'web' ? '60vh' : undefined}
      >
        <Text fontSize={20} fontWeight="700" textAlign="center">
          {this.props.title ?? 'This sale event hit a snag'}
        </Text>
        <Text fontSize={14} color="$color10" textAlign="center" maxWidth={420} lineHeight={22}>
          {message}
        </Text>
        <Button size="$4" theme="active" borderRadius={999} onPress={this.handleRetry}>
          Try again
        </Button>
      </YStack>
    )
  }
}
