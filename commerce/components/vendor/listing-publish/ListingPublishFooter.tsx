import { Platform } from 'react-native'
import { Link } from 'one'

import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle } from '~/config/tokens'
import { vendorRoutes } from '~/lib/routes'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { LISTING_PUBLISH_COPY } from './listing-publish.constants'
import { formatRelativeLastSaved } from './listing-publish.utils'

type ListingPublishFooterProps = {
  ui: AppUiTokens
  isDesktop: boolean
  safeBottom: number
  lastSavedAt: string | null
  isSaving: boolean
  isPublishing: boolean
  showPublish: boolean
  onSaveDraft: () => void
  onPublish?: () => void
}

export function ListingPublishFooter({
  ui,
  isDesktop,
  safeBottom,
  lastSavedAt,
  isSaving,
  isPublishing,
  showPublish,
  onSaveDraft,
  onPublish,
}: ListingPublishFooterProps) {
  const busy = isSaving || isPublishing
  const savedLabel = lastSavedAt
    ? `${LISTING_PUBLISH_COPY.LAST_SAVED_PREFIX} ${formatRelativeLastSaved(lastSavedAt)}`
    : LISTING_PUBLISH_COPY.LAST_SAVED_NEVER

  return (
    <XStack
      width="100%"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      flexWrap={isDesktop ? 'nowrap' : 'wrap'}
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop="$3"
      paddingBottom={(isDesktop ? 16 : 12) + safeBottom}
      borderTopWidth={1}
      borderTopColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={{
        ...getShadowStyle('md'),
        ...(Platform.OS === 'web'
          ? ({ position: 'sticky', bottom: 0, zIndex: 20 } as const)
          : undefined),
      }}
    >
      <Link href={vendorRoutes.products} asChild>
        <Button tone="ghost" size="$3" borderRadius={999} disabled={busy}>
          {LISTING_PUBLISH_COPY.CANCEL_CHANGES}
        </Button>
      </Link>

      <Text
        fontSize={12}
        color={ui.textMuted}
        fontWeight="600"
        flex={isDesktop ? 1 : undefined}
        textAlign="center"
        minWidth={isDesktop ? 0 : '100%'}
        order={isDesktop ? 0 : 3}
      >
        {savedLabel}
      </Text>

      <XStack gap="$2" alignItems="center" flexShrink={0}>
        {showPublish ? (
          <Button
            tone="outline"
            size="$4"
            borderRadius={999}
            disabled={busy}
            onPress={onSaveDraft}
            icon={isSaving ? <Spinner size="small" /> : undefined}
          >
            {LISTING_PUBLISH_COPY.SAVE_DRAFT}
          </Button>
        ) : null}
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          disabled={busy}
          onPress={showPublish && onPublish ? onPublish : onSaveDraft}
          icon={busy ? <Spinner size="small" color="white" /> : undefined}
          minWidth={showPublish ? 120 : 160}
        >
          {showPublish ? LISTING_PUBLISH_COPY.PUBLISH : LISTING_PUBLISH_COPY.SAVE_DRAFT}
        </Button>
      </XStack>
    </XStack>
  )
}

type ListingPublishTopBarProps = {
  ui: AppUiTokens
  title: string
  isSaving: boolean
  onBack: () => void
  onSaveDraft: () => void
}

export function ListingPublishTopBar({ ui, title, isSaving, onBack, onSaveDraft }: ListingPublishTopBarProps) {
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3" marginBottom="$4">
      <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
        <YStack
          width={36}
          height={36}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          onPress={onBack}
        >
          <Icons.ArrowLeft size={18} color={ui.text} />
        </YStack>
        <Text fontSize={16} fontWeight="800" color={ui.text} numberOfLines={1}>
          {title}
        </Text>
      </XStack>

      <XStack alignItems="center" gap="$2">
        <YStack
          width={36}
          height={36}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
        >
          <Icons.Bell size={17} color={ui.textSecondary} />
        </YStack>
        <YStack
          width={36}
          height={36}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          hoverStyle={{ backgroundColor: ui.surfaceMuted }}
        >
          <Icons.HelpCircle size={17} color={ui.textSecondary} />
        </YStack>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          disabled={isSaving}
          onPress={onSaveDraft}
        >
          Save Draft
        </Button>
      </XStack>
    </XStack>
  )
}
