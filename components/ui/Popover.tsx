import type { ComponentProps, ReactNode } from 'react'
import { Popover as TPopover, styled } from 'tamagui'

import { NativeFullscreenAdapt } from '~/components/ui/NativeFullscreenAdapt'
import { getShadowStyle } from '~/config/tokens'
import { isNativeFullscreenOverlay } from '~/lib/platform/native-fullscreen'
import { useAppLayout } from '~/hooks/useAppLayout'

export const Popover = TPopover

const StyledPopoverContent = styled(
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

/**
 * Popover content. On iOS/Android adapts into a full-screen sheet.
 */
export function PopoverContent({
  children,
  ...props
}: ComponentProps<typeof StyledPopoverContent> & { children?: ReactNode }) {
  const { safeTop, safeBottom } = useAppLayout()

  const nativeProps = isNativeFullscreenOverlay
    ? {
        width: '100%' as const,
        maxWidth: '100%' as const,
        borderRadius: 0,
        borderWidth: 0,
        paddingTop: Math.max(safeTop, 16),
        paddingBottom: Math.max(safeBottom, 16),
        flex: 1,
      }
    : null

  return (
    <>
      <NativeFullscreenAdapt />
      <StyledPopoverContent {...props} {...nativeProps}>
        {children}
      </StyledPopoverContent>
    </>
  )
}
