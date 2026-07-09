import { Link } from 'one'
import type { Href } from 'one'
import type { ComponentType } from 'react'

import { Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

export type NavIcon = ComponentType<{ size?: number; color?: string }>

type NavIconButtonProps = {
  href: Href
  icon: NavIcon
  label: string
  showLabel?: boolean
  badge?: number
}

/** Etsy-style nav icon — icon + small label beneath. */
export function NavIconButton({
  href,
  icon: Icon,
  label,
  showLabel,
  badge,
}: NavIconButtonProps) {
  const ui = useAppUi()

  return (
    <Link href={href} asChild>
      <YStack
        alignItems="center"
        justifyContent="center"
        gap={4}
        height={showLabel ? 50 : 40}
        minWidth={showLabel ? 60 : 40}
        paddingHorizontal="$1.5"
        borderRadius={8}
        cursor="pointer"
        hoverStyle={{ backgroundColor: ui.navHover }}
        pressStyle={{ scale: 0.96 }}
      >
        <XStack position="relative" alignItems="center" justifyContent="center">
          <Icon size={22} color={ui.text} />
          {badge && badge > 0 ? (
            <XStack
              position="absolute"
              top={-4}
              right={-8}
              minWidth={16}
              height={16}
              borderRadius={999}
              backgroundColor={ui.brand}
              alignItems="center"
              justifyContent="center"
              paddingHorizontal={3}
            >
              <Text color={ui.onBrand} fontSize={10} fontWeight="700">
                {badge > 9 ? '9+' : badge}
              </Text>
            </XStack>
          ) : null}
        </XStack>
        {showLabel ? (
          <Text fontSize={11} fontWeight="400" color={ui.text} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </YStack>
    </Link>
  )
}