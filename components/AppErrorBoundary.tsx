import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text as RNText, View } from 'react-native'

import { logger } from '~/lib/api'
import { appRoutes } from '~/lib/routes'
import { replaceApp } from '~/lib/platform/navigate'

type Props = {
  children: ReactNode
  /** Optional screen label for crash reports. */
  scope?: string
  /** Show the underlying error message even in Release (useful for meeting debug). */
  alwaysShowError?: boolean
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

function isMissingThemeError(error: Error) {
  return /missing theme/i.test(error.message ?? '')
}

/**
 * Fatal UI without Tamagui — if theme/config is broken, themed error chrome
 * would throw again and leave a black One root boundary.
 */
function FatalErrorFallback({
  message,
  supportRef,
  showDetail,
  onRetry,
  onGoHome,
  onCopyRef,
}: {
  message: string
  supportRef: string
  showDetail: boolean
  onRetry: () => void
  onGoHome: () => void
  onCopyRef: () => void
}) {
  return (
    <View style={styles.root}>
      <RNText style={styles.title}>Something went wrong</RNText>
      <RNText style={styles.body}>
        We hit an unexpected problem. Your work is safe — try again, or head home and continue.
      </RNText>
      {showDetail ? <RNText style={styles.detail}>{message}</RNText> : null}
      <View style={styles.refBox}>
        <RNText style={styles.refLabel}>Support reference</RNText>
        <Pressable onPress={onCopyRef} accessibilityRole="button">
          <RNText style={styles.refValue}>{supportRef}</RNText>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={onRetry} accessibilityRole="button">
          <RNText style={styles.primaryBtnText}>Try again</RNText>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onGoHome} accessibilityRole="button">
          <RNText style={styles.secondaryBtnText}>Go home</RNText>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: '#666',
    maxWidth: 420,
  },
  detail: {
    fontSize: 12,
    textAlign: 'center',
    color: '#D81B60',
    maxWidth: 480,
  },
  refBox: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  refLabel: {
    fontSize: 12,
    color: '#888',
  },
  refValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#D81B60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#D81B60',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  secondaryBtnText: {
    color: '#D81B60',
    fontWeight: '700',
    fontSize: 15,
  },
})

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, supportRef: null, remountKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    if (Platform.OS === 'web' && isBenignDomMutationError(error)) {
      return { error: null, supportRef: null, remountKey: Date.now() }
    }
    return { error, supportRef: buildSupportRef('APP') }
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
    if (supportRef !== this.state.supportRef) {
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
    const showErrorDetail =
      isDev || !!this.props.alwaysShowError || isMissingThemeError(this.state.error)

    return (
      <FatalErrorFallback
        message={this.state.error.message}
        supportRef={supportRef}
        showDetail={showErrorDetail}
        onRetry={this.handleRetry}
        onGoHome={this.handleGoHome}
        onCopyRef={() => void this.handleCopyRef()}
      />
    )
  }
}
