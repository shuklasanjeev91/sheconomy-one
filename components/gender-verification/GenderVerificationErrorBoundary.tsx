import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'
import { toFriendlyGenderError } from '~/lib/gender-verification'

type Props = {
  children: ReactNode
  /** Optional label for crash reports (e.g. "Modal" or "Screen"). */
  scope?: string
  /** Called when the user taps "Try again" — reset the verification flow here. */
  onReset?: () => void
  /** Heading shown above the friendly error message. */
  title?: string
}

type State = {
  error: Error | null
}

/**
 * Error boundary for the gender-verification flow. Any render error thrown while
 * loading the model, running liveness/blink detection, talking to the camera, or
 * submitting the session is caught here, logged, and surfaced through
 * `toFriendlyGenderError` so the user always sees a meaningful message — including
 * the "step back from the camera" hint for 413 / image-too-large failures.
 *
 * Mirrors `NsfwErrorBoundary`; scoped to the gender-verification module.
 */
export class GenderVerificationErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled gender-verification error', {
      scope: this.props.scope ?? 'gender-verification',
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

    const message = toFriendlyGenderError(this.state.error)

    return (
      <YStack alignItems="center" justifyContent="center" padding="$6" gap="$4" width="100%">
        <Icons.AlertTriangle size={30} color="#b45309" />
        <Text fontSize={18} fontWeight="700" textAlign="center">
          {this.props.title ?? 'Verification couldn’t continue'}
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
