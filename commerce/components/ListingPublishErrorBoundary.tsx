import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { toFriendlyListingError } from '~/lib/listing/listing.errors'
import { Button, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'

type Props = {
  children: ReactNode
  /** Optional label for crash reports (e.g. "PublishListing"). */
  scope?: string
  /** Called when the user taps "Try again" — reset publish state / retry here. */
  onReset?: () => void
  /** Heading shown above the friendly error message. */
  title?: string
}

type State = {
  error: Error | null
}

/**
 * Error boundary for the listing publication flow. Any render error thrown
 * while publishing is caught here, logged, and surfaced through the shared
 * `toFriendlyListingError` mapper so the user always sees a meaningful message
 * instead of a blank screen mid-publish.
 */
export class ListingPublishErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled listing publish error', {
      scope: this.props.scope ?? 'listing-publish',
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

    const message = toFriendlyListingError(this.state.error)

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
          {this.props.title ?? "We couldn't publish this listing"}
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
