import { Alert, Platform } from 'react-native'

/**
 * Cross-platform confirm. `Alert.alert` is a no-op on react-native-web, so
 * meeting actions (Record, Mute all, …) must use `window.confirm` on web.
 */
export function confirmMeetingAction(input: {
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
}): void {
  const {
    title,
    message,
    confirmLabel,
    cancelLabel = 'Cancel',
    destructive = false,
    onConfirm,
  } = input

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm()
    }
    return
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    {
      text: confirmLabel,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ])
}
