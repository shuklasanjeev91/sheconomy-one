import { Tooltip as TTooltip, styled } from 'tamagui'

export const Tooltip = TTooltip

export const TooltipContent = styled(
  TTooltip.Content,
  {
    name: 'TooltipContent',
    backgroundColor: '$color12',
    borderRadius: '$4',
    paddingHorizontal: '$3',
    paddingVertical: '$2',
    animation: 'quick',
    enterStyle: { opacity: 0, scale: 0.9 },
    exitStyle: { opacity: 0, scale: 0.9 },
  } as any
)

export const TooltipArrow = styled(TTooltip.Arrow, {
  name: 'TooltipArrow',
  backgroundColor: '$color12',
})