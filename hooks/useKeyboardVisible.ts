import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

/**
 * True while the software keyboard is on screen. Always false on web.
 *
 * Bottom-docked bars need the safe-area inset to clear the navigation bar or
 * home indicator, but the keyboard already covers that strip when it is open,
 * so the inset has to be dropped for as long as it is showing.
 */
export function useKeyboardVisible() {
  return useKeyboardBottomInset() > 0
}

/**
 * Software-keyboard height in pixels. Always 0 on web.
 *
 * iOS does not resize the window, so bottom composers must pad by this amount
 * or they sit behind the keyboard. Android `softwareKeyboardLayoutMode: resize`
 * already shrinks the window — do not add this inset there or the field jumps
 * twice as high.
 */
export function useKeyboardBottomInset() {
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (Platform.OS === 'web') return

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const show = Keyboard.addListener(showEvent, (event) => {
      setHeight(Math.max(0, Math.round(event.endCoordinates?.height ?? 0)))
    })
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0))

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return height
}

/** iOS keyboard overlap; Android window resize already handled. */
export function useComposerKeyboardInset() {
  const height = useKeyboardBottomInset()
  return Platform.OS === 'ios' ? height : 0
}
