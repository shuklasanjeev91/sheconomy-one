import { Select as TSelect, styled } from 'tamagui'
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

export const SelectContent = styled(
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