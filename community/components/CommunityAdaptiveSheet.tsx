import type { ReactNode } from 'react'

import { AppBottomSheet } from '~/components/ui'

type CommunityAdaptiveSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: ReactNode
  /** Kept for call-site compatibility; sheets are always bottom-anchored. */
  maxWidth?: number
  /** Use a taller sheet for article / event / celebration writers. */
  tall?: boolean
  footer?: ReactNode
}

/**
 * App-wide sheet surface — always a full-screen bottom sheet on web, iOS,
 * and Android (including desktop web). No bottom padding/margin gap.
 */
export function CommunityAdaptiveSheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: CommunityAdaptiveSheetProps) {
  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title={title} footer={footer}>
      {children}
    </AppBottomSheet>
  )
}
