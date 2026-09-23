import { useEffect, useState, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppBottomSheet, Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import {
  SHECONOMY_MEETING_COLORS,
  coworkGlassStyle,
  useCoWorkTheme,
} from '~/co-work/lib/theme'
import { coworkBoxShadow } from '~/lib/platform/crossStyles'
import { copyShareLink } from '~/lib/share'

/**
 * Large action tile for the main SHEconomy meeting dashboard.
 * - Primary Magenta for "New Meeting"
 * - Coral for "Join"
 * - Plum for "Schedule"
 * - Brand magenta for "Share Screen"
 */
export function MeetingActionTile({
  label,
  icon: Icon,
  color,
  hoverColor,
  onPress,
  busy,
  badge,
  hasDropdown,
  onDropdownPress,
}: {
  label: string
  icon: typeof Icons.Video
  color: string
  hoverColor?: string
  onPress: () => void
  busy?: boolean
  badge?: string | number
  hasDropdown?: boolean
  onDropdownPress?: () => void
}) {
  const { ui } = useCoWorkTheme()

  return (
    <YStack
      alignItems="center"
      gap="$2.5"
      flexGrow={1}
      flexShrink={1}
      flexBasis="22%"
      minWidth={130}
    >
      <XStack position="relative">
        <YStack
          width={72}
          height={72}
          borderRadius={18}
          backgroundColor={color}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          animation="quick"
          hoverStyle={{
            backgroundColor: hoverColor || color,
            scale: 1.04,
          }}
          pressStyle={{ scale: 0.96 }}
          onPress={() => {
            if (!busy) onPress()
          }}
          style={{
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.22)',
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {busy ? (
            <Spinner size="small" color="#FFFFFF" />
          ) : Icon ? (
            <Icon size={32} color="#FFFFFF" strokeWidth={2.2} />
          ) : null}
        </YStack>

        {hasDropdown ? (
          <YStack
            position="absolute"
            top={-4}
            right={-4}
            width={24}
            height={24}
            borderRadius={12}
            backgroundColor={ui.surfaceElevated}
            borderWidth={1}
            borderColor={ui.borderSoft}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            hoverStyle={{ opacity: 0.9, scale: 1.1 }}
            onPress={(e) => {
              e.stopPropagation()
              onDropdownPress?.()
            }}
            accessibilityRole="button"
            accessibilityLabel={`${label} options`}
          >
            <Icons.ChevronDown size={14} color={ui.text} />
          </YStack>
        ) : null}

        {badge !== undefined ? (
          <YStack
            position="absolute"
            top={-4}
            right={-4}
            paddingHorizontal={6}
            height={20}
            borderRadius={10}
            backgroundColor={ui.danger}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={11} fontWeight="800" color="#FFFFFF">
              {badge}
            </Text>
          </YStack>
        ) : null}
      </XStack>

      <Text
        fontSize={13}
        fontWeight="600"
        color={ui.text}
        textAlign="center"
        numberOfLines={1}
        letterSpacing={-0.2}
      >
        {label}
      </Text>
    </YStack>
  )
}

/** @deprecated Use MeetingActionTile directly */
export const SheconomyActionTile = MeetingActionTile

/**
 * Real-time digital clock and current date display for SHEconomy meeting dashboard.
 */
export function MeetingDigitalClock() {
  const { ui } = useCoWorkTheme()
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const timeString = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  const dateString = time.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <YStack gap="$1">
      <Text
        fontSize={38}
        fontWeight="800"
        color={ui.text}
        letterSpacing={-1}
        fontFamily="$heading"
      >
        {timeString}
      </Text>
      <Text fontSize={14} fontWeight="500" color={ui.textSecondary}>
        {dateString}
      </Text>
    </YStack>
  )
}

/** @deprecated Use MeetingDigitalClock directly */
export const SheconomyDigitalClock = MeetingDigitalClock

/**
 * SHEconomy Meeting Information Card / Modal.
 * Opens when tapping the security shield in the top left of the meeting room.
 */
export function MeetingInfoModal({
  open,
  onClose,
  topic,
  meetingCode,
  hostName,
  passcode,
  numericPasscode,
  shareUrl,
}: {
  open: boolean
  onClose: () => void
  topic: string
  meetingCode: string
  hostName: string
  passcode?: string | null
  numericPasscode?: string | null
  shareUrl?: string | null
}) {
  const { ui } = useCoWorkTheme()
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [copiedPasscode, setCopiedPasscode] = useState(false)

  const handleCopyLink = async () => {
    if (!shareUrl) return
    await copyShareLink(shareUrl)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleCopyId = async () => {
    if (!meetingCode) return
    await copyShareLink(meetingCode)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const handleCopyPasscode = async () => {
    if (!passcode) return
    await copyShareLink(passcode)
    setCopiedPasscode(true)
    setTimeout(() => setCopiedPasscode(false), 2000)
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={topic || 'Meeting info'}
      showHandle
      scrollable
      footer={
        shareUrl ? (
          <Button
            tone="primary"
            borderRadius={10}
            backgroundColor={ui.brand}
            width="100%"
            icon={
              copiedLink ? (
                <Icons.Check size={16} color="#FFFFFF" />
              ) : (
                <Icons.Copy size={16} color="#FFFFFF" />
              )
            }
            onPress={() => void handleCopyLink()}
          >
            {copiedLink ? 'Link copied!' : 'Copy invite link'}
          </Button>
        ) : undefined
      }
    >
      <YStack gap="$4">
        <XStack alignItems="center" gap="$2.5">
          <YStack
            width={32}
            height={32}
            borderRadius={16}
            backgroundColor="rgba(16, 185, 129, 0.15)"
            alignItems="center"
            justifyContent="center"
          >
            <Icons.ShieldCheck size={18} color={SHECONOMY_MEETING_COLORS.green} />
          </YStack>
          <Text fontSize={13} color={SHECONOMY_MEETING_COLORS.green} fontWeight="700">
            End-to-end encrypted
          </Text>
        </XStack>

        <YStack
          backgroundColor={ui.surfaceMuted}
          borderRadius={12}
          borderWidth={1}
          borderColor={ui.borderSoft}
          padding="$3"
          gap="$3"
        >
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={13} color={ui.textSecondary}>
              Meeting ID
            </Text>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={14} fontWeight="700" color={ui.text} letterSpacing={1}>
                {meetingCode}
              </Text>
              <Button
                tone="ghost"
                size="$2"
                icon={
                  copiedId ? (
                    <Icons.Check size={14} color={SHECONOMY_MEETING_COLORS.green} />
                  ) : (
                    <Icons.Copy size={14} color={ui.textSecondary} />
                  )
                }
                onPress={() => void handleCopyId()}
                accessibilityLabel="Copy meeting ID"
              />
            </XStack>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={13} color={ui.textSecondary}>
              Host
            </Text>
            <Text fontSize={13} fontWeight="600" color={ui.text}>
              {hostName}
            </Text>
          </XStack>

          {passcode ? (
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={13} color={ui.textSecondary}>
                Passcode
              </Text>
              <XStack alignItems="center" gap="$2">
                <Text fontSize={13} fontWeight="700" color={ui.text}>
                  {passcode}
                </Text>
                <Button
                  tone="ghost"
                  size="$2"
                  icon={
                    copiedPasscode ? (
                      <Icons.Check size={14} color={SHECONOMY_MEETING_COLORS.green} />
                    ) : (
                      <Icons.Copy size={14} color={ui.textSecondary} />
                    )
                  }
                  onPress={() => void handleCopyPasscode()}
                  accessibilityLabel="Copy passcode"
                />
              </XStack>
            </XStack>
          ) : null}

          {numericPasscode ? (
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={13} color={ui.textSecondary}>
                Numeric Passcode
              </Text>
              <Text fontSize={13} fontWeight="600" color={ui.text}>
                {numericPasscode}
              </Text>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    </AppBottomSheet>
  )
}

/** @deprecated Use MeetingInfoModal directly */
export const SheconomyMeetingInfoModal = MeetingInfoModal

/**
 * Security Shield Button on the Meeting Room Top Bar.
 */
export function MeetingShieldButton({ onPress }: { onPress: () => void }) {
  return (
    <XStack
      width={30}
      height={30}
      borderRadius={8}
      backgroundColor="rgba(16, 185, 129, 0.15)"
      borderWidth={1}
      borderColor="rgba(16, 185, 129, 0.35)"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      hoverStyle={{ backgroundColor: 'rgba(16, 185, 129, 0.25)', scale: 1.05 }}
      pressStyle={{ scale: 0.95 }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Meeting information"
    >
      <Icons.ShieldCheck size={16} color={SHECONOMY_MEETING_COLORS.green} />
    </XStack>
  )
}

/** @deprecated Use MeetingShieldButton directly */
export const SheconomyShieldButton = MeetingShieldButton

// ----------------------------------------------------------------------------
// Backward-compatible exports to prevent build breaks in existing imports
// ----------------------------------------------------------------------------

export function CoWorkBrandChip({ label = 'SHEconomy' }: { label?: string }) {
  const { ui } = useCoWorkTheme()
  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical={4}
      borderRadius={ui.radius.chip}
      backgroundColor={ui.chipBg}
      borderWidth={1}
      borderColor={ui.borderAccent}
      alignItems="center"
      gap={6}
    >
      <YStack width={6} height={6} borderRadius={999} backgroundColor={ui.live} />
      <Text fontSize={10} fontWeight="800" color={ui.brandLight} letterSpacing={1}>
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
  const { ui } = useCoWorkTheme()
  const styles = {
    brand: { bg: ui.brandMuted, color: ui.brandLight, border: ui.borderAccent },
    live: { bg: ui.liveMuted, color: ui.live, border: 'rgba(16, 185, 129, 0.35)' },
    warning: { bg: ui.warningMuted, color: ui.warning, border: 'rgba(245, 158, 11, 0.35)' },
    danger: { bg: ui.dangerMuted, color: ui.danger, border: 'rgba(224, 40, 40, 0.35)' },
    coral: { bg: ui.coralMuted, color: ui.coral, border: 'rgba(242, 109, 33, 0.35)' },
  }[tone]

  return (
    <XStack
      paddingHorizontal="$2"
      paddingVertical={3}
      borderRadius={ui.radius.chip}
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
  const { ui } = useCoWorkTheme()
  return (
    <Text
      fontSize={11}
      fontWeight="800"
      color={ui.textMuted}
      letterSpacing={1.2}
      textTransform="uppercase"
    >
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
  const { ui } = useCoWorkTheme()
  const bg = tone === 'warning' ? ui.warningMuted : ui.dangerMuted
  const color = tone === 'warning' ? ui.warning : ui.danger

  return (
    <XStack
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor={bg}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSoft}
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
  const { ui, shadows } = useCoWorkTheme()

  return (
    <YStack
      flex={1}
      minWidth={150}
      padding="$4"
      gap="$2.5"
      borderRadius={ui.radius.card}
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSoft}
      animation="quick"
      hoverStyle={{ y: -3, borderColor: ui.borderAccent }}
      pressStyle={{ scale: 0.98, y: 0 }}
      style={coworkBoxShadow(shadows, 'card')}
    >
      <YStack
        width={40}
        height={40}
        borderRadius={14}
        alignItems="center"
        justifyContent="center"
        backgroundColor={ui.brandMuted}
        borderWidth={1}
        borderColor={ui.borderAccent}
      >
        {icon}
      </YStack>
      <Text fontWeight="700" fontSize={15} color={ui.text}>
        {title}
      </Text>
      <Text fontSize={13} color={ui.textSecondary} lineHeight={19}>
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
  const { ui, shadows } = useCoWorkTheme()

  return (
    <YStack
      width="100%"
      height="100%"
      flex={1}
      minHeight={0}
      borderRadius={fullWidth ? 0 : ui.radius.panel}
      overflow="hidden"
      borderWidth={fullWidth ? 0 : 1}
      borderColor={ui.glassBorder}
      style={{
        ...coworkGlassStyle(ui, true),
        ...(!fullWidth ? coworkBoxShadow(shadows, 'panel') : {}),
      }}
    >
      {children}
    </YStack>
  )
}

export function CoWorkIconBadge({ icon: Icon }: { icon: typeof Icons.Video }) {
  const { ui } = useCoWorkTheme()
  return (
    <YStack
      width={44}
      height={44}
      borderRadius={14}
      alignItems="center"
      justifyContent="center"
      backgroundColor={ui.brandMuted}
      borderWidth={1}
      borderColor={ui.borderAccent}
    >
      <Icon size={20} color={ui.brandLight} />
    </YStack>
  )
}
