import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import { Platform, Switch as RNSwitch } from 'react-native'
import type { GetProps } from 'tamagui'
import { Switch as TSwitch } from 'tamagui'

import { brandColors } from '~/config/brand-colors'
import { BRAND_THEME } from '~/config/tokens'

const AnySwitch = TSwitch as unknown as ComponentType<any> & {
  Thumb: ComponentType<any>
}

export type AppSwitchProps = GetProps<typeof TSwitch> & {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}

/**
 * Cross-platform switch.
 * Native uses RN Switch for reliable hit targets; web keeps Tamagui styling.
 */
export const Switch = forwardRef<any, AppSwitchProps>(function Switch(
  { checked, defaultChecked, disabled, onCheckedChange, ...props },
  ref,
) {
  if (Platform.OS !== 'web') {
    return (
      <RNSwitch
        ref={ref}
        value={checked ?? defaultChecked ?? false}
        disabled={disabled}
        onValueChange={(next) => {
          onCheckedChange?.(next)
        }}
        trackColor={{ false: '#D8CDD2', true: brandColors.primary }}
        thumbColor="#FFFFFF"
        ios_backgroundColor="#D8CDD2"
        accessibilityRole="switch"
        style={{ transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] }}
      />
    )
  }

  return (
    <AnySwitch
      ref={ref}
      theme={BRAND_THEME}
      size="$3"
      backgroundColor="$color6"
      animation="quick"
      activeStyle={{ backgroundColor: '$color9' }}
      checked={checked}
      defaultChecked={defaultChecked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      {...props}
    >
      <AnySwitch.Thumb
        animation="quick"
        backgroundColor="white"
        shadowColor="#000"
        shadowOffset={{ width: 0, height: 1 }}
        shadowOpacity={0.15}
        shadowRadius={2}
        pointerEvents="none"
      />
    </AnySwitch>
  )
})

Switch.displayName = 'Switch'

// Keep Tamagui `Switch.Thumb` API for call sites that nest a thumb child.
;(Switch as typeof Switch & { Thumb: ComponentType<any> }).Thumb = AnySwitch.Thumb
