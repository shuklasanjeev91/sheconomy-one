import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { Button, Text, XStack, YStack } from '~/components/ui'
import { logger } from '~/lib/api'
import { appRoutes } from '~/lib/routes'
import { replaceApp } from '~/lib/platform/navigate'

type Props = {
  children: ReactNode
  /** Optional screen label for crash reports. */
  scope?: string
}

type State = {
  error: Error | null
  supportRef: string | null
  /** Bumps to remount children after a recoverable DOM mutation error. */
  remountKey: number
}

function buildSupportRef(scope?: string) {
  const stamp = Date.now().toString(36).toUpperCase()
  const scopePart = (scope ?? 'APP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()
  return `${scopePart}-${stamp}`
}

/** Browser translation / portal teardown can orphan nodes React still tries to remove. */
function isBenignDomMutationError(error: Error) {
  const message = error.message ?? ''
  return (
    error.name === 'NotFoundError' ||
    /Failed to execute '(removeChild|insertBefore)' on 'Node'/i.test(message) ||
    /The node to be removed is not a child of this node/i.test(message)
  )
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, supportRef: null, remountKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    if (Platform.OS === 'web' && isBenignDomMutationError(error)) {
      return { error: null, supportRef: null, remountKey: Date.now() }
    }
    return { error, supportRef: buildSupportRef() }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (Platform.OS === 'web' && isBenignDomMutationError(error)) {
      logger.warn('Recovered from benign DOM mutation error', {
        scope: this.props.scope,
        message: error.message,
        componentStack: info.componentStack,
        platform: Platform.OS,
      })
      return
    }

    const supportRef = this.state.supportRef ?? buildSupportRef(this.props.scope)
    if (!this.state.supportRef) {
      this.setState({ supportRef })
    }
    logger.error('Unhandled render error', {
      scope: this.props.scope,
      supportRef,
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      platform: Platform.OS,
    })
  }

  private handleRetry = () => {
    this.setState({ error: null, supportRef: null, remountKey: Date.now() })
  }

  private handleGoHome = () => {
    this.setState({ error: null, supportRef: null, remountKey: Date.now() })
    try {
      replaceApp(appRoutes.home)
    } catch {
      // Navigation may be unavailable during catastrophic failures.
    }
  }

  private handleCopyRef = async () => {
    const ref = this.state.supportRef
    if (!ref) return
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(ref)
      }
    } catch {
      /* ignore */
    }
  }

  render() {
    if (!this.state.error) {
      return <Fragment key={this.state.remountKey}>{this.props.children}</Fragment>
    }

    const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production'
    const supportRef = this.state.supportRef ?? 'UNKNOWN'

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
          We hit an unexpected problem. Your work is safe — try again, or head home and continue.
        </Text>
        {isDev ? (
          <Text fontSize={12} color="$color9" textAlign="center" maxWidth={480}>
            {this.state.error.message}
          </Text>
        ) : null}
        <YStack
          padding="$3"
          borderRadius="$4"
          borderWidth={1}
          borderColor="$borderColor"
          gap="$2"
          width="100%"
          maxWidth={360}
          alignItems="center"
        >
          <Text fontSize={12} color="$color10">
            Support reference
          </Text>
          <Text
            fontSize={14}
            fontWeight="700"
            selectable
            onPress={() => void this.handleCopyRef()}
            role="button"
            aria-label={`Copy support reference ${supportRef}`}
          >
            {supportRef}
          </Text>
          {Platform.OS === 'web' ? (
            <Text fontSize={12} color="$color9">
              Tap to copy
            </Text>
          ) : null}
        </YStack>
        <XStack gap="$3" flexWrap="wrap" justifyContent="center">
          <Button size="$4" theme="active" borderRadius={999} onPress={this.handleRetry}>
            Try again
          </Button>
          <Button size="$4" tone="outline" borderRadius={999} onPress={this.handleGoHome}>
            Go home
          </Button>
        </XStack>
      </YStack>
    )
  }
}
