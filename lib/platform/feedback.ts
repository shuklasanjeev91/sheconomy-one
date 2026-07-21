import { Platform } from 'react-native'

export type FeedbackKind = 'success' | 'selection' | 'warning' | 'destructive'

/**
 * Light haptic feedback on native; no-op on web so the same call sites stay
 * cross-platform without branching in UI code.
 */
export async function feedback(kind: FeedbackKind = 'selection'): Promise<void> {
  if (Platform.OS === 'web') return

  try {
    const Haptics = await import('expo-haptics')
    switch (kind) {
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        break
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        break
      case 'destructive':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        break
      case 'selection':
      default:
        await Haptics.selectionAsync()
        break
    }
  } catch {
    // Haptics unavailable on simulator / unsupported devices.
  }
}
