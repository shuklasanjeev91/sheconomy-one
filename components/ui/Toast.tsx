import type { ComponentType } from 'react'
import { useMemo, useRef } from 'react'
import { Pressable } from 'react-native'
import type { ThemeName } from 'tamagui'
import { XStack, YStack } from 'tamagui'
import { Text } from '~/components/ui/Text'
import { Toast as TToast, useToastController, useToastState } from '@tamagui/toast'
import { getShadowStyle } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

const AnyToast = TToast as unknown as ComponentType<any> & {
  Title: typeof TToast.Title
  Description: typeof TToast.Description
}

export type ToastTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

declare module '@tamagui/toast' {
  interface CustomData {
    tone?: ToastTone
    onPress?: () => void
    actionLabel?: string
    onAction?: () => void
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
          actionLabel?: string
          onAction?: () => void
        },
      ) => {
        controllerRef.current.show(title, {
          message: opts?.message,
          tone: opts?.tone ?? 'default',
          duration: opts?.duration,
          onPress: opts?.onPress,
          actionLabel: opts?.actionLabel,
          onAction: opts?.onAction,
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
  const ui = useAppUi()

  if (!toast || toast.isHandledNatively) {
    return null
  }

  const tone = (toast.tone as ToastTone) ?? 'default'
  const onPress = toast.onPress as (() => void) | undefined
  const actionLabel = toast.actionLabel as string | undefined
  const onAction = toast.onAction as (() => void) | undefined

  const content = (
    <XStack alignItems="center" gap="$3" justifyContent="space-between" width="100%">
      <YStack flex={1} gap="$1" minWidth={0}>
        <AnyToast.Title fontWeight="700" fontSize="$4" color="$color12">
          {toast.title}
        </AnyToast.Title>
        {toast.message ? (
          <AnyToast.Description color="$color11" fontSize="$3">
            {toast.message}
          </AnyToast.Description>
        ) : null}
      </YStack>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={{
            minHeight: 44,
            minWidth: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text fontSize={14} fontWeight="700" color={ui.brand}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </XStack>
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
      {onPress && !actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onPress}>
          {content}
        </Pressable>
      ) : (
        content
      )}
    </AnyToast>
  )
}
