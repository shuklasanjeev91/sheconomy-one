import { forwardRef, type ReactNode } from 'react'
import type { ElementRef } from 'react'

import { NavCountBadge } from '~/components/navigation/NavCountBadge'
import { Text, YStack } from '~/components/ui'

type MobileTabBarItemProps = {
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
  testID?: string
  /** Hide caption on very narrow widths — icon stays visible. */
  showLabel?: boolean
}

type YStackRef = ElementRef<typeof YStack>

/** Shared mobile bottom-tab cell — icon slot + label + optional badge. */
export const MobileTabBarItem = forwardRef<
  YStackRef,
  MobileTabBarItemProps & Record<string, unknown>
>(function MobileTabBarItem(
  {
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
    testID,
    showLabel = true,
    ...props
  },
  ref,
) {
  const compactLabel = label.length > 9

  return (
    <YStack
      ref={ref}
      {...props}
      flex={1}
      alignItems="center"
      justifyContent="flex-end"
      alignSelf="stretch"
      minWidth={0}
      width="100%"
      paddingVertical={2}
      cursor="pointer"
      pressStyle={{ opacity: 0.82, scale: 0.97 }}
      onPress={onPress}
      testID={testID}
      aria-label={accessibilityLabel ?? label}
      role="tab"
      aria-selected={isFocused}
    >
      <YStack
        width="100%"
        alignItems="center"
        justifyContent="center"
        gap={showLabel ? 3 : 0}
        paddingTop={showLabel ? 6 : 8}
        paddingBottom={showLabel ? 4 : 8}
        paddingHorizontal={4}
        borderRadius={18}
        backgroundColor={isFocused ? activePillBg : 'transparent'}
        pointerEvents="none"
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

        {showLabel ? (
          <Text
            fontSize={compactLabel ? 9 : 10}
            fontWeight={isFocused ? '700' : '500'}
            color={isFocused ? activeColor : inactiveColor}
            numberOfLines={2}
            letterSpacing={isFocused ? 0.15 : 0.05}
            textAlign="center"
            width="100%"
            lineHeight={11}
            opacity={isFocused ? 1 : 0.92}
          >
            {label}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
})
