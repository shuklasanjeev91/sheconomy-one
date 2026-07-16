import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { toFriendlyShopError } from '~/lib/shop/shop.errors'
import { Button, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'

type Props = {
  children: ReactNode
  /** Optional label for crash reports (e.g. "SellerDashboard"). */
  scope?: string
  /** Called when the user taps "Try again" — refetch / reset shop state here. */
  onReset?: () => void
  /** Heading shown above the friendly error message. */
  title?: string
}

type State = {
  error: Error | null
}

/**
 * Error boundary for shop-oriented screens. Any render error thrown inside a
 * shop flow is caught here, logged, and surfaced through the centralised
 * `toFriendlyShopError` mapper so the user always sees a meaningful message.
 */
export class ShopErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled shop error', {
      scope: this.props.scope ?? 'shop',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      platform: Platform.OS,
    })
  }

  private handleRetry = () => {
    // Remount children in-place — never full browser reload.
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = toFriendlyShopError(this.state.error)

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
          {this.props.title ?? 'This shop hit a snag'}
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
