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

    const handleShow = (event: any) => {
      const h = Math.max(0, Math.round(event?.endCoordinates?.height ?? 0))
      if (h > 0) setHeight(h)
    }
    const handleHide = () => setHeight(0)

    const subWillShow = Keyboard.addListener('keyboardWillShow', handleShow)
    const subDidShow = Keyboard.addListener('keyboardDidShow', handleShow)
    const subWillHide = Keyboard.addListener('keyboardWillHide', handleHide)
    const subDidHide = Keyboard.addListener('keyboardDidHide', handleHide)

    return () => {
      subWillShow.remove()
      subDidShow.remove()
      subWillHide.remove()
      subDidHide.remove()
    }
  }, [])

  return height
}

/** Native software keyboard inset across iOS and Android. */
export function useComposerKeyboardInset() {
  return useKeyboardBottomInset()
}
