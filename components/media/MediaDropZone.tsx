import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Icons, Text, YStack } from '~/components/ui'
import { useMediaDropZone } from '~/hooks/useMediaDropZone'
import type { MediaDropAccept } from '~/lib/media/files-from-data-transfer'
import type { PickedImage } from '~/lib/media/pick-image'
import { useAppUi } from '~/lib/theme/useAppUi'

type MediaDropZoneProps = {
  children: ReactNode
  onDrop: (items: PickedImage[]) => void
  disabled?: boolean
  accept?: MediaDropAccept
  maxCount?: number
  multiple?: boolean
  /** Compact overlay label when dragging. */
  label?: string
  /** Stretch to fill parent; default true. */
  fill?: boolean
  /** Optional min height for empty drop targets. */
  minHeight?: number
  borderRadius?: number | string
}

/** Web drag-and-drop wrapper for media uploads. */
export function MediaDropZone({
  children,
  onDrop,
  disabled = false,
  accept = 'image',
  maxCount = 1,
  multiple = false,
  label,
  fill = true,
  minHeight,
  borderRadius = 12,
}: MediaDropZoneProps) {
  const ui = useAppUi()
  const { isDragging, dropHandlers, supported } = useMediaDropZone({
    disabled,
    accept,
    maxCount,
    multiple,
    onDrop,
  })

  const hint =
    label ??
    (accept === 'video'
      ? 'Drop video here'
      : accept === 'media'
        ? 'Drop photos or videos here'
        : accept === 'any'
          ? 'Drop files here'
          : 'Drop photos here')

  if (!supported) {
    return <>{children}</>
  }

  return (
    <YStack
      position="relative"
      width={fill ? '100%' : undefined}
      minHeight={minHeight}
      borderRadius={borderRadius}
      {...(dropHandlers as object)}
      style={
        Platform.OS === 'web'
          ? ({
              outline: isDragging ? `2px dashed ${ui.brand}` : undefined,
              outlineOffset: isDragging ? 2 : undefined,
              backgroundColor: isDragging ? `${String(ui.brand)}14` : undefined,
              transition: 'background-color 120ms ease, outline 120ms ease',
            } as const)
          : undefined
      }
    >
      {children}
      {isDragging ? (
        <YStack
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          zIndex={20}
          alignItems="center"
          justifyContent="center"
          gap={8}
          borderRadius={borderRadius}
          backgroundColor="rgba(10, 102, 194, 0.12)"
          borderWidth={2}
          borderStyle="dashed"
          borderColor={ui.brand}
          pointerEvents="none"
        >
          <Icons.Upload size={28} color={ui.brand} />
          <Text fontSize={14} fontWeight="700" color={ui.brand} textAlign="center">
            {hint}
          </Text>
        </YStack>
      ) : null}
    </YStack>
  )
}
