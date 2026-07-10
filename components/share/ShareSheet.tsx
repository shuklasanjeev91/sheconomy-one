import type { ReactNode } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { ShareActionRow } from '~/components/share/ShareActionRow'
import { Icons, YStack, useAppToast } from '~/components/ui'
import { copyShareLink, shareViaSystem, type SharePayload } from '~/lib/share'

type ShareSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: SharePayload
  title?: string
  copyLabel?: string
  copyToastMessage?: string
  extraActions?: ReactNode
}

export function ShareSheet({
  open,
  onOpenChange,
  payload,
  title = 'Share',
  copyLabel = 'Copy link',
  copyToastMessage = 'Link copied to clipboard.',
  extraActions,
}: ShareSheetProps) {
  const toast = useAppToast()

  function close() {
    onOpenChange(false)
  }

  async function handleCopyLink() {
    const copied = await copyShareLink(payload.url)
    if (copied) {
      toast.show('Link copied', { tone: 'success', message: copyToastMessage })
      close()
      return
    }
    toast.show('Could not copy link', { tone: 'danger' })
  }

  async function handleNativeShare() {
    const result = await shareViaSystem(payload)
    if (result === 'copied') {
      toast.show('Link copied', { tone: 'success', message: copyToastMessage })
    }
    if (result !== 'cancelled') {
      close()
    }
  }

  return (
    <CommunityAdaptiveSheet open={open} onOpenChange={onOpenChange} title={title} maxWidth={480}>
      <YStack gap="$2">
        <ShareActionRow icon={Icons.Link} label={copyLabel} onPress={handleCopyLink} />
        <ShareActionRow icon={Icons.Share2} label="Share via…" onPress={handleNativeShare} />
        {extraActions}
      </YStack>
    </CommunityAdaptiveSheet>
  )
}
