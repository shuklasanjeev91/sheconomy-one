import type { ReactNode } from 'react'
import { useState } from 'react'

import { ShareSheet } from '~/components/share/ShareSheet'
import { Button, Icons } from '~/components/ui'
import type { SharePayload } from '~/lib/share'

type ShareButtonProps = {
  payload: SharePayload
  label?: string
  variant?: 'icon' | 'outline' | 'ghost'
  size?: '$3' | '$4'
  sheetTitle?: string
  copyLabel?: string
  copyToastMessage?: string
  extraActions?: ReactNode
}

export function ShareButton({
  payload,
  label = 'Share',
  variant = 'outline',
  size = '$3',
  sheetTitle,
  copyLabel,
  copyToastMessage,
  extraActions,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false)

  if (variant === 'icon') {
    return (
      <>
        <Button
          tone="ghost"
          size={size}
          borderRadius={999}
          icon={<Icons.Share2 size={18} />}
          aria-label={label}
          onPress={() => setOpen(true)}
        />
        <ShareSheet
          open={open}
          onOpenChange={setOpen}
          payload={payload}
          title={sheetTitle ?? label}
          copyLabel={copyLabel}
          copyToastMessage={copyToastMessage}
          extraActions={extraActions}
        />
      </>
    )
  }

  return (
    <>
      <Button
        tone={variant === 'ghost' ? 'ghost' : 'outline'}
        size={size}
        borderRadius={999}
        icon={<Icons.Share2 size={15} />}
        onPress={() => setOpen(true)}
      >
        {label}
      </Button>
      <ShareSheet
        open={open}
        onOpenChange={setOpen}
        payload={payload}
        title={sheetTitle ?? label}
        copyLabel={copyLabel}
        copyToastMessage={copyToastMessage}
        extraActions={extraActions}
      />
    </>
  )
}
