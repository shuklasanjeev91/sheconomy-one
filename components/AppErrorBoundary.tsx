import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { Button, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'

type Props = {
  children: ReactNode
  /** Optional screen label for crash reports. */
  scope?: string
}

type State = {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled render error', {
      scope: this.props.scope,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      platform: Platform.OS,
    })
  }

  private handleRetry = () => {
    // Remount children in-place — never full browser reload (that kills Vite SPA state).
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children

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
          Something went wrong
        </Text>
        <Text fontSize={14} color="$color10" textAlign="center" maxWidth={420} lineHeight={22}>
          {this.state.error.message || 'An unexpected error occurred. Please try again.'}
        </Text>
        <Button size="$4" theme="active" borderRadius={999} onPress={this.handleRetry}>
          Try again
        </Button>
      </YStack>
    )
  }
}
