import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Platform, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import { Icons, Sheet, SheetFrame, SheetHandle, SheetOverlay, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { isNativeFullscreenOverlay } from '~/lib/platform/native-fullscreen'
import { useAppUi } from '~/lib/theme/useAppUi'

// Approximate non-scrolling chrome heights so the scroll body can extend as
// close to full screen as possible while still leaving room for these.
const HANDLE_CHROME = 28
const HEADER_CHROME = 52
const FOOTER_CHROME = 72

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
  /**
   * @deprecated Sheets always cover the full viewport. Kept for call-site compatibility.
   */
  maxHeightRatio?: number
}

/**
 * Cross-platform bottom sheet — always covers the full device / viewport
 * (web, iOS, Android) with no bottom padding or margin gap.
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
}: AppBottomSheetProps) {
  const ui = useAppUi()
  const { safeTop } = useAppLayout()
  const { height: windowHeight } = useWindowDimensions()
  const nativeFullscreen = isNativeFullscreenOverlay

  const maxSheetHeight = useMemo(() => windowHeight, [windowHeight])

  // Space taken by the handle/header/footer that sits outside the scroll body.
  const chromeHeight =
    (showHandle ? HANDLE_CHROME : 0) +
    HEADER_CHROME +
    (footer ? FOOTER_CHROME : 0) +
    (nativeFullscreen ? safeTop : 0)

  const body = (
    <YStack paddingHorizontal="$4" paddingTop="$3" paddingBottom="$3" gap="$3" width="100%">
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
      snapPoints={[100]}
      snapPointsMode="percent"
      zIndex={100_000}
      animation="quick"
    >
      <SheetOverlay />
      <SheetFrame
        padding={0}
        margin={0}
        backgroundColor={ui.surface}
        borderTopLeftRadius={0}
        borderTopRightRadius={0}
        borderBottomLeftRadius={0}
        borderBottomRightRadius={0}
        overflow="hidden"
        height={windowHeight}
        maxHeight={windowHeight}
        minHeight={windowHeight}
        width="100%"
        flex={1}
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
      >
        <YStack
          width="100%"
          flex={1}
          height="100%"
          maxHeight={maxSheetHeight}
          paddingTop={nativeFullscreen ? safeTop : 0}
          paddingBottom={0}
          marginBottom={0}
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
              flex={1}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingBottom: 0, flexGrow: 1 }}
              {...(Platform.OS === 'web'
                ? {
                    maxHeight: `calc(100vh - ${chromeHeight}px)` as unknown as number,
                  }
                : {})}
            >
              {body}
            </Sheet.ScrollView>
          ) : (
            <YStack flex={1} width="100%" paddingBottom={0}>
              {body}
            </YStack>
          )}

          {footer ? (
            <YStack
              width="100%"
              paddingHorizontal="$4"
              paddingTop="$3"
              paddingBottom="$3"
              marginBottom={0}
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
