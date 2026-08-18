import type { ComponentType } from 'react'
import { useMemo, useRef } from 'react'
import { Platform, Pressable, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { XStack, YStack } from 'tamagui'
import { Text } from '~/components/ui/Text'
import { Toast as TToast, useToastController, useToastState } from '@tamagui/toast'
import { getShadowStyle, radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useAppUi, useIsDarkTheme } from '~/lib/theme/useAppUi'
import { resolveToastText } from '~/lib/ux/toast-text'

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

/** Inset from the screen edge on both sides. */
const TOAST_GUTTER = 12
/** Cap on wide screens so a desktop toast doesn't span the whole viewport. */
const TOAST_MAX_WIDTH = 480
const TOAST_MIN_WIDTH = 220

function toneAccent(ui: AppUiTokens, tone: ToastTone) {
  if (tone === 'success') return ui.success
  if (tone === 'warning') return ui.starFill
  if (tone === 'danger') return ui.error
  if (tone === 'info') return ui.link
  return ui.brand
}

/**
 * `const toast = useAppToast(); toast.show('Saved', { tone: 'success' })`
 *
 * Returns a stable reference so it's safe to include in effect/callback
 * dependency arrays without triggering re-run loops.
 *
 * A toast with no readable text is dropped instead of shown — plenty of call
 * sites pass a server string straight through (`toast.show(result.error)`),
 * and an undefined title used to surface as an empty card.
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
        const text = resolveToastText(title, opts?.message)
        if (!text) return

        controllerRef.current.show(text.title, {
          message: text.message,
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
  const isDark = useIsDarkTheme()
  const insets = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()

  /**
   * The toast frame is a shrink-to-fit child of Tamagui's toast viewport. Web
   * can size that from the text's intrinsic width, but Yoga (iOS/Android) has
   * no intrinsic sizing: `flex: 1` inside an auto-width row resolves to 0pt, so
   * the label collapsed to nothing and the card painted as an empty rounded box
   * over the header. A resolved pixel width keeps the text laid out everywhere.
   */
  const available = windowWidth - TOAST_GUTTER * 2 - insets.left - insets.right
  const frameWidth = Math.round(
    Math.max(TOAST_MIN_WIDTH, Math.min(TOAST_MAX_WIDTH, available || TOAST_MAX_WIDTH)),
  )
  // Web centers the card with the frame's own `marginHorizontal: auto`. Yoga
  // resolves an auto cross-axis margin to flex-start, so native gets a measured
  // left offset instead.
  const horizontalMargin =
    Platform.OS === 'web'
      ? { marginHorizontal: 'auto' as const }
      : {
          marginLeft: Math.round(
            TOAST_GUTTER + insets.left + Math.max(0, (available - frameWidth) / 2),
          ),
          marginRight: TOAST_GUTTER,
        }

  const text = resolveToastText(toast?.title, toast?.message)

  // No toast, handled by the OS, or nothing readable — never paint a blank card.
  if (!toast || toast.isHandledNatively || !text) {
    return null
  }

  const { title, message } = text
  const tone = (toast.tone as ToastTone) ?? 'default'
  const accent = toneAccent(ui, tone)
  const onPress = toast.onPress as (() => void) | undefined
  const actionLabel = toast.actionLabel as string | undefined
  const onAction = toast.onAction as (() => void) | undefined

  const content = (
    <XStack alignSelf="stretch" alignItems="center" gap={10}>
      <YStack
        width={4}
        alignSelf="stretch"
        minHeight={24}
        borderRadius={radius.pill}
        backgroundColor={accent}
      />
      <YStack flex={1} minWidth={0} gap={2}>
        <AnyToast.Title
          fontSize={15}
          lineHeight={20}
          fontWeight="700"
          color={ui.text}
          numberOfLines={2}
        >
          {title}
        </AnyToast.Title>
        {message ? (
          <AnyToast.Description
            fontSize={13}
            lineHeight={18}
            color={ui.textSecondary}
            numberOfLines={3}
          >
            {message}
          </AnyToast.Description>
        ) : null}
      </YStack>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={12}
          style={{
            flexShrink: 0,
            minHeight: 32,
            justifyContent: 'center',
            paddingHorizontal: 6,
          }}
        >
          <Text fontSize={14} fontWeight="700" color={ui.brand} numberOfLines={1}>
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
      viewportName={toast.viewportName ?? 'default'}
      width={frameWidth}
      maxWidth={frameWidth}
      {...horizontalMargin}
      backgroundColor={ui.elevatedSurface}
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.border}
      paddingHorizontal={14}
      paddingVertical={12}
      animation="quick"
      enterStyle={{ opacity: 0, y: -12, scale: 0.98 }}
      exitStyle={{ opacity: 0, y: -12, scale: 0.98 }}
      {...getShadowStyle('md', isDark ? 'dark' : 'light')}
    >
      {onPress && !actionLabel ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ alignSelf: 'stretch' }}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </AnyToast>
  )
}
