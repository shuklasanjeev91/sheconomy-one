import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Platform, useWindowDimensions } from 'react-native'

import { Icons, Sheet, SheetFrame, SheetHandle, SheetOverlay, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

const SHEET_MAX_HEIGHT_RATIO = 0.92

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
}

/**
 * Cross-platform bottom sheet — fits content up to ~92% viewport, scrolls when needed,
 * safe-area padding on native, and always shows a close icon.
 */
export function AppBottomSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  showHandle = true,
  scrollable = true,
}: AppBottomSheetProps) {
  const ui = useAppUi()
  const { safeBottom } = useAppLayout()
  const { height: windowHeight } = useWindowDimensions()

  const maxSheetHeight = useMemo(
    () => Math.round(windowHeight * SHEET_MAX_HEIGHT_RATIO),
    [windowHeight],
  )

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
      snapPointsMode="fit"
      zIndex={100_000}
      animation="quick"
    >
      <SheetOverlay />
      <SheetFrame
        padding="$0"
        backgroundColor={ui.surface}
        borderTopLeftRadius={radius.surface}
        borderTopRightRadius={radius.surface}
        overflow="hidden"
        maxHeight={maxSheetHeight}
      >
        <YStack width="100%" maxHeight={maxSheetHeight}>
          {showHandle ? (
            <YStack paddingTop="$2.5" paddingBottom="$1" alignItems="center" width="100%">
              <SheetHandle />
            </YStack>
          ) : null}

          <BottomSheetHeader title={title} onClose={close} />

          {scrollable ? (
            <Sheet.ScrollView
              width="100%"
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              {...(Platform.OS === 'web'
                ? {
                    maxHeight: `calc(${SHEET_MAX_HEIGHT_RATIO * 100}vh - 140px)` as unknown as number,
                  }
                : {})}
            >
              {body}
            </Sheet.ScrollView>
          ) : (
            body
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
