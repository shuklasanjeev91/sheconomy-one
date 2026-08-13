import type { ReactNode } from 'react'

import { Icons, Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

/**
 * Theme-aware SHEconomy palette for the cart & checkout screens. Values map to
 * the shared brand tokens (`useAppUi`) so light/dark and every platform stay
 * consistent with the rest of the app.
 */
export function useCommercePalette() {
  const ui = useAppUi()
  return {
    page: ui.background,
    panel: ui.surface,
    text: ui.text,
    secondary: ui.textSecondary,
    muted: ui.textMuted,
    link: ui.link,
    linkHover: ui.brandDark,
    price: ui.text,
    priceStrong: ui.brand,
    border: ui.border,
    borderDark: ui.borderSubtle,
    divider: ui.borderSubtle,
    inStock: ui.success,
    brand: ui.brand,
    onBrand: ui.onBrand,
    surfaceMuted: ui.surfaceMuted,
    surfaceHover: ui.surfaceHover,
    chip: ui.chip,
    imagePlaceholder: ui.imagePlaceholder,
  }
}

type CommerceButtonVariant = 'primary' | 'secondary'

export function CommerceButton({
  children,
  variant = 'primary',
  onPress,
  disabled,
  width,
  height = 44,
  fontSize = 15,
  fontWeight = '700',
}: {
  children: ReactNode
  variant?: CommerceButtonVariant
  onPress?: () => void
  disabled?: boolean
  width?: number | string
  height?: number
  fontSize?: number
  fontWeight?: '400' | '500' | '600' | '700'
}) {
  const ui = useAppUi()
  const styles =
    variant === 'primary'
      ? { bg: ui.brand, hover: ui.brandDark, border: ui.brand, color: ui.onBrand }
      : { bg: ui.surface, hover: ui.surfaceHover, border: ui.border, color: ui.text }

  return (
    <XStack
      role="button"
      onPress={disabled ? undefined : onPress}
      alignItems="center"
      justifyContent="center"
      backgroundColor={styles.bg}
      borderColor={styles.border}
      borderWidth={1}
      borderRadius={100}
      height={height}
      width={width as never}
      paddingHorizontal="$4"
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? 0.55 : 1}
      hoverStyle={disabled ? undefined : { backgroundColor: styles.hover, borderColor: styles.hover }}
      pressStyle={disabled ? undefined : { backgroundColor: styles.hover, opacity: 0.92 }}
      animation="quick"
    >
      <Text fontSize={fontSize} color={styles.color} fontWeight={fontWeight} numberOfLines={1}>
        {children}
      </Text>
    </XStack>
  )
}

/** Brand-coloured inline link text. */
export function CommerceLink({
  children,
  onPress,
  fontSize = 13,
}: {
  children: ReactNode
  onPress?: () => void
  fontSize?: number
}) {
  const ui = useAppUi()
  return (
    <Text
      onPress={onPress}
      fontSize={fontSize}
      color={ui.link}
      cursor="pointer"
      hoverStyle={{ color: ui.brandDark }}
    >
      {children}
    </Text>
  )
}

/** Small square checkbox in the brand accent. */
export function CommerceCheckbox({
  checked,
  onPress,
  size = 18,
}: {
  checked: boolean
  onPress?: () => void
  size?: number
}) {
  const ui = useAppUi()
  return (
    <XStack
      role="checkbox"
      onPress={onPress}
      width={size}
      height={size}
      borderRadius={4}
      borderWidth={1.5}
      borderColor={checked ? ui.brand : ui.border}
      backgroundColor={checked ? ui.brand : ui.surface}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      flexShrink={0}
      hoverStyle={{ borderColor: ui.brand }}
    >
      {checked ? <Icons.Check size={size - 5} color={ui.onBrand} strokeWidth={3} /> : null}
    </XStack>
  )
}

/** Radio dot in the brand accent. */
export function CommerceRadio({
  selected,
  size = 20,
}: {
  selected: boolean
  size?: number
}) {
  const ui = useAppUi()
  return (
    <XStack
      width={size}
      height={size}
      borderRadius={size}
      borderWidth={2}
      borderColor={selected ? ui.brand : ui.border}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      backgroundColor={ui.surface}
    >
      {selected ? (
        <XStack width={size - 10} height={size - 10} borderRadius={size} backgroundColor={ui.brand} />
      ) : null}
    </XStack>
  )
}
