import { forwardRef } from 'react'
import type { ComponentProps, ElementRef } from 'react'
import { Platform } from 'react-native'
import { ScrollView as TamaguiScrollView } from 'tamagui'

type ScrollViewProps = ComponentProps<typeof TamaguiScrollView>

/**
 * Tamagui's ScrollView with iOS keyboard insets on by default.
 *
 * The iOS keyboard floats over the app instead of resizing the window, so a
 * focused input near the bottom of a scroll view ends up behind it. Android
 * needs nothing here — `softwareKeyboardLayoutMode: "resize"` in app.json
 * already shrinks the window. Horizontal rails are skipped since a bottom
 * inset does nothing useful for them.
 */
export const ScrollView = forwardRef<ElementRef<typeof TamaguiScrollView>, ScrollViewProps>(
  function ScrollView(props, ref) {
    const avoidsKeyboard = Platform.OS === 'ios' && !props.horizontal

    return (
      <TamaguiScrollView
        ref={ref}
        // Before the spread so call sites can still opt out.
        {...(avoidsKeyboard ? { automaticallyAdjustKeyboardInsets: true } : null)}
        {...props}
      />
    )
  },
)
