import type { ReactNode } from 'react'
import { useState } from 'react'

import { ShareSheet } from '~/components/share/ShareSheet'
import { Button, Icons } from '~/components/ui'
import type { SharePayload } from '~/lib/share'

type ShareButtonProps = {
  payload: SharePayload
  label?: string
  variant?: 'icon' | 'outline' | 'ghost'
  size?: '$2' | '$3' | '$4'
  sheetTitle?: string
  copyLabel?: string
  copyToastMessage?: string
  extraActions?: ReactNode
  onOpen?: () => void
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
  onOpen,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false)

  function handleOpen() {
    onOpen?.()
    setOpen(true)
  }

  const sheet = open ? (
    <ShareSheet
      open={open}
      onOpenChange={setOpen}
      payload={payload}
      title={sheetTitle ?? label}
      copyLabel={copyLabel}
      copyToastMessage={copyToastMessage}
      extraActions={extraActions}
    />
  ) : null

  if (variant === 'icon') {
    return (
      <>
        <Button
          tone="ghost"
          size={size}
          borderRadius={999}
          icon={<Icons.Share2 size={18} />}
          aria-label={label}
          onPress={handleOpen}
        />
        {sheet}
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
        onPress={handleOpen}
      >
        {label}
      </Button>
      {sheet}
    </>
  )
}
