import type { ComponentProps, ReactNode } from 'react'
import { Select as TSelect, styled } from 'tamagui'

import { NativeFullscreenAdapt } from '~/components/ui/NativeFullscreenAdapt'
import { getShadowStyle } from '~/config/tokens'

/** Same compound API as Tamagui's Select — restyled trigger + content. */
export const Select = TSelect

export const SelectTrigger = styled(TSelect.Trigger, {
  name: 'SelectTrigger',
  borderRadius: '$5',
  borderWidth: 1.5,
  borderColor: '$borderColor',
  backgroundColor: '$color2',
  paddingHorizontal: '$3.5',
  height: '$4.5',
})

const StyledSelectContent = styled(
  TSelect.Content,
  {
    zIndex: 200_000,
  } as any
)

export const SelectViewport = styled(TSelect.Viewport, {
  name: 'SelectViewport',
  backgroundColor: '$background',
  borderRadius: '$6',
  borderWidth: 1,
  borderColor: '$borderColor',
  ...getShadowStyle('md'),
})

export const SelectItem = styled(TSelect.Item, {
  name: 'SelectItem',
  borderRadius: '$4',
  paddingHorizontal: '$3',
})

/**
 * Select dropdown content. Always adapts into a bottom sheet on web, iOS,
 * and Android so every Select covers the device / viewport from the bottom.
 */
export function SelectContent({
  children,
  ...props
}: ComponentProps<typeof StyledSelectContent> & { children?: ReactNode }) {
  return (
    <>
      <NativeFullscreenAdapt />
      <StyledSelectContent {...props}>{children}</StyledSelectContent>
    </>
  )
}
