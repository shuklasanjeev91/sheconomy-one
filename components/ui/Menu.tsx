import type { ComponentProps, ReactNode } from 'react'
import { Menu as TMenu, ContextMenu as TContextMenu, styled } from 'tamagui'

import { getShadowStyle } from '~/config/tokens'

/**
 * Dropdown menu (`Menu`) and right-click menu (`ContextMenu`) share the same
 * anatomy in Tamagui — restyle both content/item surfaces once, reuse twice.
 * Note: unlike Select/Popover, Menu does not support Tamagui Adapt.
 */
export const Menu = TMenu
export const ContextMenu = TContextMenu

const StyledMenuContent = styled(
  TMenu.Content,
  {
    name: 'MenuContent',
    backgroundColor: '$background',
    borderRadius: '$6',
    borderWidth: 1,
    borderColor: '$borderColor',
    padding: '$1.5',
    minWidth: 180,
    animation: 'quick',
    enterStyle: { opacity: 0, scale: 0.96, y: -4 },
    exitStyle: { opacity: 0, scale: 0.96, y: -4 },
    ...getShadowStyle('md'),
  } as any
)

export const MenuItem = styled(TMenu.Item, {
  name: 'MenuItem',
  borderRadius: '$4',
  paddingHorizontal: '$3',
  paddingVertical: '$2.5',
  backgroundColor: 'transparent',
  hoverStyle: { backgroundColor: '$color4' },
})

const StyledContextMenuContent = styled(
  TContextMenu.Content,
  {
    name: 'ContextMenuContent',
    backgroundColor: '$background',
    borderRadius: '$6',
    borderWidth: 1,
    borderColor: '$borderColor',
    padding: '$1.5',
    minWidth: 200,
    animation: 'quick',
    enterStyle: { opacity: 0, scale: 0.96 },
    exitStyle: { opacity: 0, scale: 0.96 },
    ...getShadowStyle('md'),
  } as any
)

export const ContextMenuItem = styled(TContextMenu.Item, {
  name: 'ContextMenuItem',
  borderRadius: '$4',
  paddingHorizontal: '$3',
  paddingVertical: '$2.5',
  backgroundColor: 'transparent',
  hoverStyle: { backgroundColor: '$color4' },
})

export function MenuContent({
  children,
  ...props
}: ComponentProps<typeof StyledMenuContent> & { children?: ReactNode }) {
  // Menu does not support Tamagui Adapt — use a plain dropdown surface.
  return <StyledMenuContent {...props}>{children}</StyledMenuContent>
}

export function ContextMenuContent({
  children,
  ...props
}: ComponentProps<typeof StyledContextMenuContent> & { children?: ReactNode }) {
  // ContextMenu does not support Tamagui Adapt — use a plain dropdown surface.
  return <StyledContextMenuContent {...props}>{children}</StyledContextMenuContent>
}
