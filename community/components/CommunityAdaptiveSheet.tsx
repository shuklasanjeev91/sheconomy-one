import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import {
  AppBottomSheet,
  BottomSheetHeader,
  Dialog,
  DialogContent,
  DialogOverlay,
  YStack,
  useMedia,
} from '~/components/ui'
import { radius } from '~/config/tokens'

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
  const media = useMedia()
  const isDesktop = media.gtMd

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} modal>
        <Dialog.Portal>
          <DialogOverlay />
          <DialogContent
            maxWidth={maxWidth}
            width="92%"
            padding="$0"
            overflow="hidden"
            borderRadius={radius.card}
            showClose={false}
          >
            <BottomSheetHeader title={title} onClose={() => onOpenChange(false)} />
            <YStack
              padding="$4"
              gap="$3"
              maxHeight="80vh"
              overflow="scroll"
              {...(Platform.OS === 'web' ? { style: { overflowY: 'auto' as const } } : {})}
            >
              {children}
            </YStack>
          </DialogContent>
        </Dialog.Portal>
      </Dialog>
    )
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      {children}
    </AppBottomSheet>
  )
}
