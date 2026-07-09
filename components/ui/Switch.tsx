import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps } from 'tamagui'
import { Switch as TSwitch } from 'tamagui'
import { BRAND_THEME } from '~/config/tokens'

const AnySwitch = TSwitch as unknown as ComponentType<any> & {
  Thumb: ComponentType<any>
}

export const Switch = forwardRef<any, GetProps<typeof TSwitch>>(function Switch(props, ref) {
  return (
    <AnySwitch
      ref={ref}
      theme={BRAND_THEME}
      size="$3"
      backgroundColor="$color6"
      animation="quick"
      activeStyle={{ backgroundColor: '$color9' }}
      {...props}
    >
      <AnySwitch.Thumb
        animation="quick"
        backgroundColor="white"
        shadowColor="#000"
        shadowOffset={{ width: 0, height: 1 }}
        shadowOpacity={0.15}
        shadowRadius={2}
      />
    </AnySwitch>
  )
})

Switch.displayName = 'Switch'