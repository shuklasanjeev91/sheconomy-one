import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Text, YStack } from '~/components/ui'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import type { ListingEditorSectionId } from '~/commerce/components/vendor/listing-publish/listing-publish.constants'

type ListingEditorSectionProps = {
  ui: AppUiTokens
  id: ListingEditorSectionId
  title: string
  subtitle?: string
  children: ReactNode
}

/** Anchor wrapper for Dukaan-style single-page product editor sections. */
export function ListingEditorSection({
  ui,
  id,
  title,
  subtitle,
  children,
}: ListingEditorSectionProps) {
  const anchorId = `listing-section-${id}`
  return (
    <YStack
      nativeID={anchorId}
      gap="$3"
      width="100%"
      {...(Platform.OS === 'web'
        ? ({ id: anchorId, style: { scrollMarginTop: 96 } } as const)
        : {})}
    >
      <YStack gap="$1">
        <Text fontSize={20} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
          {title}
        </Text>
        {subtitle ? (
          <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
            {subtitle}
          </Text>
        ) : null}
      </YStack>
      {children}
    </YStack>
  )
}
