import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogTitle,
  Icons,
  Sheet,
  SheetFrame,
  SheetHandle,
  SheetOverlay,
  Text,
  XStack,
  YStack,
  useMedia,
} from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type CommunityAdaptiveSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  maxWidth?: number
}

/** Bottom sheet on mobile/tablet; centered dialog on desktop. */
export function CommunityAdaptiveSheet({
  open,
  onOpenChange,
  title,
  children,
  maxWidth = 520,
}: CommunityAdaptiveSheetProps) {
  const ui = useAppUi()
  const media = useMedia()
  const isDesktop = media.gtMd

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} modal>
        <Dialog.Portal>
          <DialogOverlay />
          <DialogContent maxWidth={maxWidth} width="92%" padding="$0" overflow="hidden">
            {title ? (
              <SheetHeader title={title} onClose={() => onOpenChange(false)} />
            ) : null}
            <YStack padding="$4" gap="$3" maxHeight="80vh" overflow="scroll">
              {children}
            </YStack>
          </DialogContent>
        </Dialog.Portal>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal snapPointsMode="fit" dismissOnSnapToBottom>
      <SheetOverlay />
      <SheetFrame padding="$0" backgroundColor={ui.surface}>
        <YStack width="100%" gap="$3" paddingBottom="$4">
          <YStack paddingTop="$3" alignItems="center">
            <SheetHandle />
          </YStack>
          {title ? (
            <SheetHeader title={title} onClose={() => onOpenChange(false)} />
          ) : null}
          <YStack paddingHorizontal="$4" gap="$3" maxHeight="75vh">
            {children}
          </YStack>
        </YStack>
      </SheetFrame>
    </Sheet>
  )
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const ui = useAppUi()

  return (
    <XStack
      paddingHorizontal="$4"
      paddingBottom="$2"
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
    >
      <Text fontSize={18} fontWeight="700" color={ui.text}>
        {title}
      </Text>
      <XStack
        padding="$2"
        borderRadius={999}
        cursor="pointer"
        hoverStyle={{ backgroundColor: ui.surfaceHover }}
        onPress={onClose}
      >
        <Icons.X size={20} color={ui.icon} />
      </XStack>
    </XStack>
  )
}