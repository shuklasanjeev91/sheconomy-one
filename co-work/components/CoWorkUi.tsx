import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { coworkGlassStyle, useCoWorkTheme } from '~/co-work/lib/theme'

export function CoWorkBrandChip({ label = 'CO-WORK' }: { label?: string }) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical={4}
      borderRadius={coworkUi.radius.chip}
      backgroundColor={coworkUi.chipBg}
      borderWidth={1}
      borderColor={coworkUi.borderAccent}
      alignItems="center"
      gap={6}
    >
      <YStack width={6} height={6} borderRadius={999} backgroundColor={coworkUi.live} />
      <Text fontSize={10} fontWeight="800" color={coworkUi.brandLight} letterSpacing={1}>
        {label}
      </Text>
    </XStack>
  )
}

export function CoWorkStatusPill({
  label,
  tone = 'brand',
}: {
  label: string
  tone?: 'brand' | 'live' | 'warning' | 'danger' | 'coral'
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const styles = {
    brand: { bg: coworkUi.brandMuted, color: coworkUi.brandLight, border: coworkUi.borderAccent },
    live: { bg: coworkUi.liveMuted, color: coworkUi.live, border: 'rgba(52,211,153,0.35)' },
    warning: { bg: coworkUi.warningMuted, color: coworkUi.warning, border: 'rgba(251,191,36,0.35)' },
    danger: { bg: coworkUi.dangerMuted, color: coworkUi.danger, border: 'rgba(244,63,104,0.35)' },
    coral: { bg: coworkUi.coralMuted, color: coworkUi.coral, border: 'rgba(248,120,64,0.35)' },
  }[tone]

  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical={3}
      borderRadius={coworkUi.radius.chip}
      backgroundColor={styles.bg}
      borderWidth={1}
      borderColor={styles.border}
    >
      <Text fontSize={11} fontWeight="700" color={styles.color}>
        {label}
      </Text>
    </XStack>
  )
}

export function CoWorkSectionLabel({ children }: { children: string }) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  return (
    <Text fontSize={11} fontWeight="800" color={coworkUi.textMuted} letterSpacing={1.2} textTransform="uppercase">
      {children}
    </Text>
  )
}

export function CoWorkAlertBanner({
  message,
  tone,
  actionLabel,
  onAction,
}: {
  message: string
  tone: 'warning' | 'danger'
  actionLabel?: string
  onAction?: () => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const bg = tone === 'warning' ? coworkUi.warningMuted : coworkUi.dangerMuted
  const color = tone === 'warning' ? coworkUi.warning : coworkUi.danger

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor={bg}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      borderBottomWidth={1}
      borderBottomColor={coworkUi.borderSoft}
    >
      <Text flex={1} color={color} fontSize={13} lineHeight={18}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button tone="ghost" size="$2" onPress={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </XStack>
  )
}

export function CoWorkFeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()

  return (
    <YStack
      flex={1}
      minWidth={150}
      padding="$4"
      gap="$2"
      borderRadius={coworkUi.radius.card}
      backgroundColor={coworkUi.surface}
      borderWidth={1}
      borderColor={coworkUi.borderSoft}
      style={Platform.OS === 'web' ? { boxShadow: coworkShadows.card } : undefined}
    >
      <YStack
        width={40}
        height={40}
        borderRadius={14}
        alignItems="center"
        justifyContent="center"
        backgroundColor={coworkUi.brandMuted}
        borderWidth={1}
        borderColor={coworkUi.borderAccent}
      >
        {icon}
      </YStack>
      <Text fontWeight="700" fontSize={15} color={coworkUi.text}>
        {title}
      </Text>
      <Text fontSize={13} color={coworkUi.textSecondary} lineHeight={19}>
        {description}
      </Text>
    </YStack>
  )
}

export function CoWorkPanelShell({
  children,
  fullWidth,
}: {
  children: ReactNode
  fullWidth?: boolean
}) {
  const { ui: coworkUi, shadows: coworkShadows } = useCoWorkTheme()

  return (
    <YStack
      width={fullWidth ? '100%' : 360}
      maxWidth="100%"
      height="100%"
      borderRadius={fullWidth ? 0 : coworkUi.radius.panel}
      overflow="hidden"
      borderWidth={fullWidth ? 0 : 1}
      borderColor={coworkUi.glassBorder}
      style={{
        ...coworkGlassStyle(coworkUi, true),
        ...(Platform.OS === 'web' && !fullWidth ? { boxShadow: coworkShadows.panel } : {}),
      }}
    >
      {children}
    </YStack>
  )
}

export function CoWorkIconBadge({ icon: Icon }: { icon: typeof Icons.Video }) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  return (
    <YStack
      width={44}
      height={44}
      borderRadius={14}
      alignItems="center"
      justifyContent="center"
      backgroundColor={coworkUi.brandMuted}
      borderWidth={1}
      borderColor={coworkUi.borderAccent}
    >
      <Icon size={20} color={coworkUi.brandLight} />
    </YStack>
  )
}
