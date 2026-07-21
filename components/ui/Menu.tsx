import type { ComponentProps, ReactNode } from 'react'
import { Menu as TMenu, ContextMenu as TContextMenu, styled } from 'tamagui'

import { NativeFullscreenAdapt } from '~/components/ui/NativeFullscreenAdapt'
import { getShadowStyle } from '~/config/tokens'
import { isNativeFullscreenOverlay } from '~/lib/platform/native-fullscreen'
import { useAppLayout } from '~/hooks/useAppLayout'

/**
 * Dropdown menu (`Menu`) and right-click menu (`ContextMenu`) share the same
 * anatomy in Tamagui — restyle both content/item surfaces once, reuse twice.
 * On iOS/Android content adapts into a full-screen sheet.
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

function useOverlaySheetContentProps() {
  const { safeTop } = useAppLayout()
  return {
    width: '100%' as const,
    maxWidth: '100%' as const,
    minWidth: '100%' as const,
    borderRadius: isNativeFullscreenOverlay ? 0 : undefined,
    borderWidth: isNativeFullscreenOverlay ? 0 : undefined,
    paddingTop: Math.max(safeTop, 16),
    paddingBottom: 0,
    marginBottom: 0,
    ...(isNativeFullscreenOverlay ? { flex: 1 } : null),
  }
}

export function MenuContent({
  children,
  ...props
}: ComponentProps<typeof StyledMenuContent> & { children?: ReactNode }) {
  const sheetProps = useOverlaySheetContentProps()
  return (
    <>
      <NativeFullscreenAdapt />
      <StyledMenuContent {...props} {...sheetProps}>
        {children}
      </StyledMenuContent>
    </>
  )
}

export function ContextMenuContent({
  children,
  ...props
}: ComponentProps<typeof StyledContextMenuContent> & { children?: ReactNode }) {
  const sheetProps = useOverlaySheetContentProps()
  return (
    <>
      <NativeFullscreenAdapt />
      <StyledContextMenuContent {...props} {...sheetProps}>
        {children}
      </StyledContextMenuContent>
    </>
  )
}
