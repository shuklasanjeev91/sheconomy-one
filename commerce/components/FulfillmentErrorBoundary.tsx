import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { toFriendlyOrderError } from '~/lib/orders/order.errors'
import { Button, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'

type Props = {
  children: ReactNode
  /** Optional label for crash reports (e.g. "Fulfillments", "FulfillmentDetail"). */
  scope?: string
  /** Called when the user taps "Try again" — refetch / reset fulfillment state here. */
  onReset?: () => void
  /** Heading shown above the friendly error message. */
  title?: string
}

type State = {
  error: Error | null
}

/**
 * Error boundary for fulfillment / logistics screens. Any render error thrown
 * inside a fulfillment flow is caught here, logged, and surfaced through the
 * shared `toFriendlyOrderError` mapper so the user always sees a meaningful
 * message.
 */
export class FulfillmentErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled fulfillment error', {
      scope: this.props.scope ?? 'fulfillment',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      platform: Platform.OS,
    })
  }

  private handleRetry = () => {
    this.setState({ error: null })
    this.props.onReset?.()
    if (!this.props.onReset && Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = toFriendlyOrderError(this.state.error)

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
          {this.props.title ?? 'Couldn’t load fulfillment'}
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
