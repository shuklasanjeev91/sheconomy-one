import type { ReactNode } from 'react'

import { AppBottomSheet } from '~/components/ui'

type CommunityAdaptiveSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  /** Kept for call-site compatibility; sheets are always bottom-anchored. */
  maxWidth?: number
}

/**
 * App-wide sheet surface — always a bottom sheet on web, iOS, and Android
 * (including desktop web). Never opens as a centered dialog/modal.
 */
export function CommunityAdaptiveSheet({
  open,
  onOpenChange,
  title,
  children,
}: CommunityAdaptiveSheetProps) {
  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title={title}>
      {children}
    </AppBottomSheet>
  )
}
