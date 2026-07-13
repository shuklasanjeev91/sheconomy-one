import type { ReactNode } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { ShareActionRow } from '~/components/share/ShareActionRow'
import { Icons, Separator, Text, XStack, YStack, useAppToast } from '~/components/ui'
import {
  canUseSystemShare,
  copyShareLink,
  openShareTarget,
  shareViaSystem,
  type ShareTargetKey,
  type SharePayload,
} from '~/lib/share'
import { useAppUi } from '~/lib/theme/useAppUi'

type ShareSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payload: SharePayload
  title?: string
  copyLabel?: string
  copyToastMessage?: string
  extraActions?: ReactNode
}

type ShareTarget = {
  key: ShareTargetKey
  label: string
  icon: typeof Icons.Link
  color: string
}

const SHARE_TARGETS: ShareTarget[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: Icons.MessageCircle, color: '#25D366' },
  { key: 'linkedin', label: 'LinkedIn', icon: Icons.Linkedin, color: '#0A66C2' },
  { key: 'x', label: 'X', icon: Icons.Twitter, color: '#1DA1F2' },
  { key: 'facebook', label: 'Facebook', icon: Icons.Facebook, color: '#1877F2' },
  { key: 'telegram', label: 'Telegram', icon: Icons.Send, color: '#229ED9' },
  { key: 'email', label: 'Email', icon: Icons.Mail, color: '#EA4335' },
]

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

  async function handleTargetPress(target: ShareTarget) {
    const opened = await openShareTarget(target.key, payload)
    if (!opened) {
      toast.show(`Could not open ${target.label}`, { tone: 'danger' })
      return
    }
    close()
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
      <YStack gap="$3">
        <XStack flexWrap="wrap" justifyContent="flex-start" rowGap="$3">
          {SHARE_TARGETS.map((target) => (
            <ShareTargetButton key={target.key} target={target} onPress={() => handleTargetPress(target)} />
          ))}
        </XStack>

        <Separator />

        <YStack gap="$2">
          <ShareActionRow icon={Icons.Link} label={copyLabel} onPress={handleCopyLink} />
          {canUseSystemShare() ? (
            <ShareActionRow icon={Icons.Share2} label="More options…" onPress={handleNativeShare} />
          ) : null}
          {extraActions}
        </YStack>
      </YStack>
    </CommunityAdaptiveSheet>
  )
}

function ShareTargetButton({
  target,
  onPress,
}: {
  target: ShareTarget
  onPress: () => void
}) {
  const ui = useAppUi()
  const Icon = target.icon

  return (
    <YStack
      width="25%"
      minWidth={72}
      alignItems="center"
      gap="$1.5"
      paddingVertical="$2"
      cursor="pointer"
      hoverStyle={{ opacity: 0.85 }}
      pressStyle={{ opacity: 0.7 }}
      onPress={onPress}
      accessibilityLabel={`Share on ${target.label}`}
    >
      <YStack
        width={52}
        height={52}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={target.color}
      >
        <Icon size={24} color="#ffffff" />
      </YStack>
      <Text fontSize={12} fontWeight="500" color={ui.textSecondary} numberOfLines={1}>
        {target.label}
      </Text>
    </YStack>
  )
}
