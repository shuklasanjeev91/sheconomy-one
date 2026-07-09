import { Popover as TPopover, styled } from 'tamagui'
import { getShadowStyle } from '~/config/tokens'

export const Popover = TPopover

export const PopoverContent = styled(
  TPopover.Content,
  {
    name: 'PopoverContent',
    backgroundColor: '$background',
    borderRadius: '$6',
    borderWidth: 1,
    borderColor: '$borderColor',
    padding: '$3.5',
    gap: '$2',
    animation: 'quick',
    enterStyle: { opacity: 0, scale: 0.96, y: -4 },
    exitStyle: { opacity: 0, scale: 0.96, y: -4 },
    ...getShadowStyle('md'),
  } as any
)

export const PopoverArrow = styled(TPopover.Arrow, {
  name: 'PopoverArrow',
  borderWidth: 1,
  borderColor: '$borderColor',
})