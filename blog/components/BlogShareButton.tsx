import { useState } from 'react'

import { Button, Icons, Popover, Text, useAppToast, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { blogRoutes } from '~/lib/routes'
import { buildAbsoluteUrl } from '~/lib/platform/url'
import { copyShareLink, openShareTarget, shareViaSystem } from '~/lib/share/actions'
import { useAppUi } from '~/lib/theme/useAppUi'

export function BlogShareButton({ title, slug }: { title: string; slug: string }) {
  const ui = useAppUi()
  const toast = useAppToast()
  const [open, setOpen] = useState(false)
  const url = buildAbsoluteUrl(String(blogRoutes.post(slug)))
  const payload = { url, title, text: title }

  async function copy() {
    const ok = await copyShareLink(url)
    toast.show(ok ? 'Link copied' : 'Could not copy link', { tone: ok ? 'success' : 'danger' })
    setOpen(false)
  }

  async function shareSystem() {
    const result = await shareViaSystem(payload)
    if (result === 'copied') toast.show('Link copied', { tone: 'success' })
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
      <Popover.Trigger asChild>
        <Button size="$3" tone="outline" icon={Icons.Share2}>
          Share
        </Button>
      </Popover.Trigger>
      <Popover.Content
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        borderRadius={radius.card}
        padding="$2"
        minWidth={180}
      >
        <YStack gap="$1">
          {(
            [
              { label: 'Copy link', action: () => void copy() },
              { label: 'Share…', action: () => void shareSystem() },
              {
                label: 'WhatsApp',
                action: () => void openShareTarget('whatsapp', payload).then(() => setOpen(false)),
              },
              {
                label: 'X / Twitter',
                action: () => void openShareTarget('x', payload).then(() => setOpen(false)),
              },
              {
                label: 'LinkedIn',
                action: () => void openShareTarget('linkedin', payload).then(() => setOpen(false)),
              },
              {
                label: 'Facebook',
                action: () => void openShareTarget('facebook', payload).then(() => setOpen(false)),
              },
            ] as const
          ).map((item) => (
            <XStack
              key={item.label}
              paddingHorizontal="$3"
              paddingVertical="$2.5"
              borderRadius={radius.chip}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceMuted }}
              pressStyle={{ opacity: 0.85 }}
              onPress={item.action}
            >
              <Text fontSize={14} color={ui.text}>
                {item.label}
              </Text>
            </XStack>
          ))}
        </YStack>
      </Popover.Content>
    </Popover>
  )
}
