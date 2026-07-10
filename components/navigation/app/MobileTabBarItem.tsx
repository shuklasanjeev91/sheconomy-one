import type { ReactNode } from 'react'

import { NavCountBadge } from '~/components/navigation/NavCountBadge'
import { Text, YStack } from '~/components/ui'

export type MobileTabBarItemProps = {
  label: string
  isFocused: boolean
  activeColor: string
  inactiveColor: string
  activePillBg: string
  badge?: number
  badgeBorderColor?: string
  children: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
}

/** Shared mobile bottom-tab cell — icon slot + label + optional badge. */
export function MobileTabBarItem({
  label,
  isFocused,
  activeColor,
  inactiveColor,
  activePillBg,
  badge,
  badgeBorderColor,
  children,
  onPress,
  accessibilityLabel,
  ...props
}: MobileTabBarItemProps & Record<string, unknown>) {
  const compactLabel = label.length > 9

  return (
    <YStack
      {...props}
      flex={1}
      alignItems="center"
      justifyContent="flex-end"
      alignSelf="stretch"
      minWidth={0}
      width="100%"
      paddingVertical={2}
      cursor="pointer"
      animation="quick"
      pressStyle={{ opacity: 0.82, scale: 0.97 }}
      onPress={onPress}
      aria-label={accessibilityLabel ?? label}
      role="tab"
      aria-selected={isFocused}
    >
      <YStack
        width="100%"
        alignItems="center"
        justifyContent="center"
        gap={3}
        paddingTop={6}
        paddingBottom={4}
        paddingHorizontal={4}
        borderRadius={18}
        backgroundColor={isFocused ? activePillBg : 'transparent'}
        animation="quick"
      >
        <YStack
          width={32}
          height={32}
          alignItems="center"
          justifyContent="center"
          position="relative"
          overflow="visible"
        >
          {children}
          {badge != null && badge > 0 ? (
            <NavCountBadge count={badge} size="sm" borderColor={badgeBorderColor} />
          ) : null}
        </YStack>

        <Text
          fontSize={compactLabel ? 9 : 10}
          fontWeight={isFocused ? '700' : '500'}
          color={isFocused ? activeColor : inactiveColor}
          numberOfLines={1}
          letterSpacing={isFocused ? 0.15 : 0.05}
          textAlign="center"
          width="100%"
          lineHeight={12}
          opacity={isFocused ? 1 : 0.92}
        >
          {label}
        </Text>
      </YStack>
    </YStack>
  )
}
