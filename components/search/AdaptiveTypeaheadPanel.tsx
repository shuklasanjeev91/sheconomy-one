import type { ReactNode } from 'react'

import { AppBottomSheet, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useScrollNearEnd } from '~/hooks/useScrollNearEnd'
import { useAppUi } from '~/lib/theme/useAppUi'
import { ScreenSearchField } from '~/components/search/ScreenSearchField'

type AdaptiveTypeaheadPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  /** Desktop anchored panel max height (px). */
  maxHeight?: number
  /** When 'top', panel opens above the anchor (desktop only). */
  placement?: 'top' | 'bottom'
  /** Desktop z-index override. */
  zIndex?: number
  scrollable?: boolean
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  showSearchOnDesktop?: boolean
  onScrollNearEnd?: () => void
  scrollNearEndEnabled?: boolean
  scrollNearEndLoading?: boolean
}

/**
 * LinkedIn-style typeahead shell: anchored scroll panel on desktop, bottom sheet on mobile.
 */
export function AdaptiveTypeaheadPanel({
  open,
  onOpenChange,
  title,
  children,
  maxHeight = 480,
  placement = 'bottom',
  zIndex = 400,
  scrollable = true,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search',
  showSearchOnDesktop = false,
  onScrollNearEnd,
  scrollNearEndEnabled = false,
  scrollNearEndLoading = false,
}: AdaptiveTypeaheadPanelProps) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()
  const { handleScroll, handleWebScroll } = useScrollNearEnd(
    () => onScrollNearEnd?.(),
    {
      enabled: scrollNearEndEnabled && Boolean(onScrollNearEnd),
      loading: scrollNearEndLoading,
    },
  )
  const searchField =
    onSearchChange != null ? (
      <YStack padding="$2" paddingBottom="$0">
        <ScreenSearchField
          value={searchValue ?? ''}
          onChangeText={onSearchChange}
          placeholder={searchPlaceholder}
          clearable
        />
      </YStack>
    ) : null

  if (isDesktop) {
    if (!open) return null
    return (
      <YStack
        position="absolute"
        left={0}
        right={0}
        {...(placement === 'top'
          ? { bottom: '100%', marginBottom: 8 }
          : { top: '100%', marginTop: 8 })}
        zIndex={zIndex}
        backgroundColor={ui.surface}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        borderRadius={20}
        overflow="hidden"
        maxHeight={maxHeight}
        // @ts-expect-error web overflow scroll
        onScroll={scrollNearEndEnabled ? handleWebScroll : undefined}
        style={{
          boxShadow: '0 16px 48px rgba(16, 12, 14, 0.14)',
          overflowY: scrollable ? 'auto' : 'hidden',
        }}
      >
        {showSearchOnDesktop ? searchField : null}
        {children}
      </YStack>
    )
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      scrollable={scrollable}
      onScroll={scrollNearEndEnabled ? handleScroll : undefined}
    >
      {searchField}
      {children}
    </AppBottomSheet>
  )
}
