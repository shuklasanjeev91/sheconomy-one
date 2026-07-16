import type { ComponentType } from 'react'
import { useMemo, useRef } from 'react'
import { Pressable } from 'react-native'
import type { ThemeName } from 'tamagui'
import { Toast as TToast, useToastController, useToastState } from '@tamagui/toast'
import { getShadowStyle } from '~/config/tokens'

const AnyToast = TToast as unknown as ComponentType<any> & {
  Title: typeof TToast.Title
  Description: typeof TToast.Description
}

export type ToastTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

declare module '@tamagui/toast' {
  interface CustomData {
    tone?: ToastTone
    onPress?: () => void
  }
}

const TONE_THEME: Partial<Record<ToastTone, ThemeName>> = {
  default: undefined,
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  info: 'blue',
}

/**
 * `const toast = useAppToast(); toast.show('Saved', { tone: 'success' })`
 *
 * Returns a stable reference so it's safe to include in effect/callback
 * dependency arrays without triggering re-run loops.
 */
export function useAppToast() {
  const controller = useToastController()
  const controllerRef = useRef(controller)
  controllerRef.current = controller

  return useMemo(
    () => ({
      show: (
        title: string,
        opts?: {
          message?: string
          tone?: ToastTone
          duration?: number
          onPress?: () => void
        },
      ) => {
        controllerRef.current.show(title, {
          message: opts?.message,
          tone: opts?.tone ?? 'default',
          duration: opts?.duration,
          onPress: opts?.onPress,
        })
      },
      hide: (...args: Parameters<typeof controller.hide>) =>
        controllerRef.current.hide(...args),
    }),
    [],
  )
}

/** Mount once near the root — renders whatever `useAppToast().show()` triggers. */
export function AppToasts() {
  const toast = useToastState()

  if (!toast || toast.isHandledNatively) {
    return null
  }

  const tone = (toast.tone as ToastTone) ?? 'default'
  const onPress = toast.onPress as (() => void) | undefined

  const content = (
    <>
      <AnyToast.Title fontWeight="700" fontSize="$4" color="$color12">
        {toast.title}
      </AnyToast.Title>
      {toast.message ? (
        <AnyToast.Description color="$color11" fontSize="$3">
          {toast.message}
        </AnyToast.Description>
      ) : null}
    </>
  )

  return (
    <AnyToast
      key={toast.id}
      duration={toast.duration}
      viewportName={toast.viewport}
      theme={TONE_THEME[tone]}
      backgroundColor="$background"
      borderRadius="$6"
      borderWidth={1}
      borderColor="$borderColor"
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      marginHorizontal="$3"
      gap="$1"
      animation="quick"
      enterStyle={{ opacity: 0, y: -12, scale: 0.98 }}
      exitStyle={{ opacity: 0, y: -12, scale: 0.98 }}
      {...getShadowStyle('md')}
    >
      {onPress ? (
        <Pressable accessibilityRole="button" onPress={onPress}>
          {content}
        </Pressable>
      ) : (
        content
      )}
    </AnyToast>
  )
}