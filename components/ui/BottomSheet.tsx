import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Platform, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import { Icons, Sheet, SheetFrame, SheetHandle, SheetOverlay, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { isNativeFullscreenOverlay } from '~/lib/platform/native-fullscreen'
import { useAppUi } from '~/lib/theme/useAppUi'

const DEFAULT_SHEET_MAX_HEIGHT_RATIO = 0.92
// Approximate non-scrolling chrome heights so the scroll body can extend as
// close to full screen as possible while still leaving room for these.
const HANDLE_CHROME = 28
const HEADER_CHROME = 52
const FOOTER_CHROME = 88

type BottomSheetHeaderProps = {
  title?: string
  onClose: () => void
}

/** Sheet title row with always-visible close control. */
export function BottomSheetHeader({ title, onClose }: BottomSheetHeaderProps) {
  const ui = useAppUi()

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$2.5"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      minHeight={52}
    >
      <Text flex={1} fontSize={18} fontWeight="700" color={ui.text} letterSpacing={-0.2} numberOfLines={2}>
        {title ?? ''}
      </Text>
      <XStack
        width={40}
        height={40}
        alignItems="center"
        justifyContent="center"
        borderRadius={radius.pill}
        cursor="pointer"
        aria-label="Close"
        hoverStyle={{ backgroundColor: ui.surfaceHover }}
        pressStyle={{ opacity: 0.75, scale: 0.94 }}
        animation="quick"
        onPress={onClose}
      >
        <Icons.X size={22} color={ui.text} />
      </XStack>
    </XStack>
  )
}

type AppBottomSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  /** Sticky footer below scrollable body (e.g. filter actions). */
  footer?: ReactNode
  /** Show drag handle above the header. */
  showHandle?: boolean
  /** Wrap body in Sheet.ScrollView (disable for short static content). */
  scrollable?: boolean
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  /** Fraction of viewport height (0–1). Web only — native always fills the screen. */
  maxHeightRatio?: number
}

/**
 * Cross-platform bottom sheet.
 * - Web: fits content up to ~92% viewport, scrolls when needed.
 * - iOS / Android: always covers the full device screen.
 */
export function AppBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  showHandle = true,
  scrollable = true,
  onScroll,
  maxHeightRatio = DEFAULT_SHEET_MAX_HEIGHT_RATIO,
}: AppBottomSheetProps) {
  const ui = useAppUi()
  const { safeBottom, safeTop } = useAppLayout()
  const { height: windowHeight } = useWindowDimensions()
  const nativeFullscreen = isNativeFullscreenOverlay

  const sheetRatio = Math.min(0.98, Math.max(0.5, maxHeightRatio))

  const maxSheetHeight = useMemo(
    () => (nativeFullscreen ? windowHeight : Math.round(windowHeight * sheetRatio)),
    [windowHeight, sheetRatio, nativeFullscreen],
  )

  // Space taken by the handle/header/footer that sits outside the scroll body.
  const chromeHeight =
    (showHandle ? HANDLE_CHROME : 0) +
    HEADER_CHROME +
    (footer ? FOOTER_CHROME : 0) +
    (nativeFullscreen ? safeTop : 0)
  const scrollMaxHeight = Math.max(200, maxSheetHeight - chromeHeight)

  const bottomInset = Math.max(16, safeBottom)

  const body = (
    <YStack paddingHorizontal="$4" paddingTop="$3" paddingBottom={footer ? '$3' : bottomInset} gap="$3" width="100%">
      {children}
    </YStack>
  )

  function close() {
    onOpenChange(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      modal
      dismissOnSnapToBottom
      {...(nativeFullscreen
        ? { snapPoints: [100], snapPointsMode: 'percent' as const }
        : { snapPointsMode: 'fit' as const })}
      zIndex={100_000}
      animation="quick"
    >
      <SheetOverlay />
      <SheetFrame
        padding="$0"
        backgroundColor={ui.surface}
        borderTopLeftRadius={nativeFullscreen ? 0 : radius.surface}
        borderTopRightRadius={nativeFullscreen ? 0 : radius.surface}
        overflow="hidden"
        maxHeight={maxSheetHeight}
        {...(nativeFullscreen
          ? {
              height: windowHeight,
              flex: 1,
              width: '100%',
            }
          : {})}
      >
        <YStack
          width="100%"
          maxHeight={maxSheetHeight}
          {...(nativeFullscreen ? { flex: 1, height: '100%', paddingTop: safeTop } : {})}
        >
          {showHandle ? (
            <YStack paddingTop="$2.5" paddingBottom="$1" alignItems="center" width="100%">
              <SheetHandle />
            </YStack>
          ) : null}

          <BottomSheetHeader title={title} onClose={close} />

          {scrollable ? (
            <Sheet.ScrollView
              width="100%"
              flex={nativeFullscreen ? 1 : undefined}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
              maxHeight={nativeFullscreen ? undefined : scrollMaxHeight}
              {...(Platform.OS === 'web'
                ? {
                    maxHeight: `calc(${sheetRatio * 100}vh - ${chromeHeight}px)` as unknown as number,
                  }
                : {})}
            >
              {body}
            </Sheet.ScrollView>
          ) : (
            <YStack flex={nativeFullscreen ? 1 : undefined} width="100%">
              {body}
            </YStack>
          )}

          {footer ? (
            <YStack
              width="100%"
              paddingHorizontal="$4"
              paddingTop="$3"
              paddingBottom={bottomInset}
              borderTopWidth={1}
              borderTopColor={ui.borderSubtle}
              backgroundColor={ui.surface}
            >
              {footer}
            </YStack>
          ) : null}
        </YStack>
      </SheetFrame>
    </Sheet>
  )
}
