import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { toFriendlyNsfwError } from '~/lib/nsfwjs/nsfw.errors'
import { Button, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'

type Props = {
  children: ReactNode
  /** Optional label for crash reports (e.g. "ImageUpload"). */
  scope?: string
  /** Called when the user taps "Try again" — reset the upload/analysis flow here. */
  onReset?: () => void
  /** Heading shown above the friendly error message. */
  title?: string
}

type State = {
  error: Error | null
}

/**
 * Error boundary for the NSFW image-safety flow. Any render error thrown while
 * checking or uploading images (model load failure, analysis error, rejected
 * content surfaced as a thrown error) is caught here, logged, and surfaced
 * through `toFriendlyNsfwError` so the user always sees a meaningful message.
 *
 * Mirrors `ListingErrorBoundary`; scoped to the NSFW module.
 */
export class NsfwErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled NSFW moderation error', {
      scope: this.props.scope ?? 'nsfw',
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

    const message = toFriendlyNsfwError(this.state.error)

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
          {this.props.title ?? 'Image safety check failed'}
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
