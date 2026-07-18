import type { ComponentType, ReactNode } from 'react'

import { Switch, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

type IconComponent = ComponentType<{ size?: number; color?: string }>

export function SettingsSectionHeading({ title }: { title: string }) {
  const ui = useAppUi()
  return (
    <XStack gap="$2.5" alignItems="center">
      <YStack width={3} height={18} borderRadius={999} backgroundColor={ui.brand} opacity={0.85} />
      <Text fontWeight="700" fontSize={15} color={ui.text} letterSpacing={-0.15}>
        {title}
      </Text>
    </XStack>
  )
}

export function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  return (
    <YStack gap="$4" width="100%">
      {/* Mobile/tablet: title + back live in AppMobileHeader — avoid duplicate chrome. */}
      {isDesktop ? (
        <YStack gap="$1.5">
          <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
            {title}
          </Text>
          {description ? (
            <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
              {description}
            </Text>
          ) : null}
        </YStack>
      ) : null}
      {children}
    </YStack>
  )
}

export function PreferenceRow({
  icon: Icon,
  title,
  subtitle,
  defaultChecked,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: IconComponent
  title: string
  subtitle?: string
  defaultChecked?: boolean
  checked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  const ui = useAppUi()

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      hoverStyle={{ backgroundColor: ui.navHover }}
      opacity={disabled ? 0.7 : 1}
    >
      <XStack alignItems="center" gap="$3" flex={1}>
        <Icon size={18} color={ui.textSecondary} />
        <YStack gap={2} flex={1} minWidth={0}>
          <Text fontSize={15} color={ui.text}>
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={13} color={ui.textMuted}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      {typeof onCheckedChange === 'function' || checked != null || defaultChecked != null ? (
        checked == null ? (
          <Switch defaultChecked={defaultChecked} disabled={disabled} />
        ) : (
          <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
        )
      ) : null}
    </XStack>
  )
}
