import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Platform } from 'react-native'

import { Button, Text, YStack } from '~/components/ui'
import { logger } from '~/lib/api'
import { toFriendlyShopReviewError } from '~/lib/shop-review/shop-review.errors'
import { SHOP_REVIEW_UI_COPY } from '~/lib/shop-review/shop-review-ui.copy'

type Props = {
  children: ReactNode
  scope?: string
  onReset?: () => void
  title?: string
}

type State = {
  error: Error | null
}

export class ShopReviewErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Unhandled shop review error', {
      scope: this.props.scope ?? 'shop-review',
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

    const message = toFriendlyShopReviewError(this.state.error)

    return (
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        padding="$6"
        gap="$4"
        backgroundColor="$background"
        minHeight={Platform.OS === 'web' ? '50vh' : undefined}
      >
        <Text fontSize={20} fontWeight="700" textAlign="center">
          {this.props.title ?? SHOP_REVIEW_UI_COPY.hubErrorTitle}
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
