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
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'web') return

    // iOS reports `will` events early enough to animate with the keyboard;
    // Android only fires the `did` pair.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const show = Keyboard.addListener(showEvent, () => setVisible(true))
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false))

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return visible
}
