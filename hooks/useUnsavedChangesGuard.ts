import { useEffect, useRef } from 'react'
import { Alert, BackHandler, Platform } from 'react-native'
import { useNavigation } from 'one'

type Options = {
  isDirty: boolean
  title?: string
  message?: string
}

/**
 * Warn before leaving a dirty form — browser beforeunload on web, Android
 * hardware back + React Navigation beforeRemove on native.
 */
export function useUnsavedChangesGuard({
  isDirty,
  title = 'Discard changes?',
  message = 'You have unsaved changes. If you leave now, they will be lost.',
}: Options) {
  const navigation = useNavigation()
  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') return

    const unsubscribe = navigation?.addListener?.('beforeRemove', (event: any) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      Alert.alert(title, message, [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            dirtyRef.current = false
            navigation.dispatch(event.data.action)
          },
        },
      ])
    })

    return unsubscribe
  }, [message, navigation, title])

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dirtyRef.current) return false
      Alert.alert(title, message, [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            dirtyRef.current = false
            if (navigation?.canGoBack?.()) navigation.goBack()
          },
        },
      ])
      return true
    })

    return () => sub.remove()
  }, [message, navigation, title])
}
