import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { toFriendlyAddressError } from '~/lib/address/address.errors'
import { Button, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'

type Props = {
  children: ReactNode
  scope?: string
  onReset?: () => void
  title?: string
}

type State = {
  error: Error | null
}

/**
 * Error boundary for address-oriented screens. Catches render failures and
 * surfaces them through the centralised `toFriendlyAddressError` mapper.
 */
export class AddressErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled address error', {
      scope: this.props.scope ?? 'address',
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      platform: Platform.OS,
    })
  }

  private handleRetry = () => {
    // Remount children in-place — never full browser reload (keeps Vite SPA shell).
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = toFriendlyAddressError(this.state.error)

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
          {this.props.title ?? 'Address management hit a snag'}
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
