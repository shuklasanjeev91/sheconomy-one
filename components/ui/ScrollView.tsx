import { forwardRef } from 'react'
import type { ComponentProps, ElementRef } from 'react'
import { Platform, StyleSheet } from 'react-native'
import { ScrollView as TamaguiScrollView } from 'tamagui'
import { useKeyboardBottomInset } from '~/hooks/useKeyboardVisible'

type ScrollViewProps = ComponentProps<typeof TamaguiScrollView>

/**
 * Cross-platform ScrollView with automatic software-keyboard avoidance.
 *
 * On iOS and Android (especially in edge-to-edge / transparent system bar modes),
 * the software keyboard overlays the window. This ensures all vertical scroll
 * views automatically expand their scrollable padding so focused inputs and text
 * boxes are never obscured behind the keyboard UI.
 */
export const ScrollView = forwardRef<ElementRef<typeof TamaguiScrollView>, ScrollViewProps>(
  function ScrollView(props, ref) {
    const keyboardHeight = useKeyboardBottomInset()
    const isVertical = !props.horizontal
    const avoidsKeyboard = Platform.OS !== 'web' && isVertical

    const flattenedContentStyle = StyleSheet.flatten(props.contentContainerStyle) || {}
    const existingPaddingBottom =
      typeof flattenedContentStyle.paddingBottom === 'number'
        ? flattenedContentStyle.paddingBottom
        : 0

    // With AppShell already shrinking the viewport to the top of the software keyboard,
    // add comfortable scroll clearance so the lowest input doesn't sit flush against the keyboard edge.
    const extraBottomPad =
      avoidsKeyboard && keyboardHeight > 0
        ? Math.max(existingPaddingBottom, 32)
        : existingPaddingBottom

    const mergedContentStyle = {
      ...flattenedContentStyle,
      paddingBottom: extraBottomPad,
    }

    return (
      <TamaguiScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        {...(avoidsKeyboard ? { automaticallyAdjustKeyboardInsets: true } : null)}
        {...props}
        contentContainerStyle={mergedContentStyle}
      />
    )
  },
)
