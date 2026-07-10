import { forwardRef } from 'react'
import type { ComponentType } from 'react'
import type { GetProps } from 'tamagui'
import { ListItem as TListItem } from 'tamagui'
import { radius } from '~/config/tokens'

const AnyListItem = TListItem as unknown as ComponentType<any>

export const ListItem = forwardRef<any, GetProps<typeof TListItem>>(function ListItem(
  props,
  ref
) {
  return (
    <AnyListItem
      ref={ref}
      backgroundColor="transparent"
      borderRadius={radius.chip}
      paddingVertical="$3"
      paddingHorizontal="$3.5"
      animation="smooth"
      hoverStyle={{ backgroundColor: '$color3', x: 2 }}
      pressStyle={{ backgroundColor: '$color4', scale: 0.99, x: 0 }}
      {...props}
    />
  )
})

ListItem.displayName = 'ListItem'
