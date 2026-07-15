import { Link, usePathname } from 'one'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

import {
  filterSettingsNav,
  settingsSectionFromPath,
  type SettingsNavItem,
} from './config'

const GROUP_LABELS: Record<SettingsNavItem['group'], string> = {
  account: 'Your account',
  products: 'Products',
  more: 'More',
}

export function SettingsNav({
  showShop,
  compact = false,
  onNavigate,
}: {
  showShop: boolean
  /** Hub list style (mobile index). */
  compact?: boolean
  onNavigate?: () => void
}) {
  const ui = useAppUi()
  const pathname = usePathname()
  const activeId = settingsSectionFromPath(pathname)
  const items = filterSettingsNav(showShop)

  const groups: SettingsNavItem['group'][] = ['account', 'products', 'more']

  return (
    <YStack gap={compact ? '$4' : '$3'} width="100%">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.group === group)
        if (groupItems.length === 0) return null
        return (
          <YStack key={group} gap="$1.5">
            <Text
              fontSize={12}
              fontWeight="700"
              color={ui.textMuted}
              letterSpacing={0.4}
              textTransform="uppercase"
              paddingHorizontal={compact ? '$1' : '$2'}
            >
              {GROUP_LABELS[group]}
            </Text>
            <YStack gap={compact ? '$1' : 2}>
              {groupItems.map((item) => {
                const active = activeId === item.id
                const Icon = item.icon
                return (
                  <Link key={item.id} href={item.href} asChild>
                    <XStack
                      alignItems="center"
                      gap="$3"
                      paddingHorizontal={compact ? '$3.5' : '$3'}
                      paddingVertical={compact ? '$3.5' : '$2.5'}
                      borderRadius={compact ? 12 : 10}
                      backgroundColor={active ? ui.surfaceMuted : 'transparent'}
                      hoverStyle={{ backgroundColor: active ? ui.surfaceMuted : ui.navHover }}
                      cursor="pointer"
                      onPress={onNavigate}
                    >
                      <Icon size={compact ? 20 : 18} color={active ? ui.brand : ui.textSecondary} />
                      <YStack flex={1} gap={compact ? 2 : 0} minWidth={0}>
                        <Text
                          fontSize={compact ? 16 : 14}
                          fontWeight={active ? '700' : '600'}
                          color={active ? ui.text : ui.text}
                        >
                          {item.label}
                        </Text>
                        {compact ? (
                          <Text fontSize={13} color={ui.textMuted} numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </YStack>
                      {compact ? <Icons.ChevronRight size={16} color={ui.textMuted} /> : null}
                    </XStack>
                  </Link>
                )
              })}
            </YStack>
          </YStack>
        )
      })}
    </YStack>
  )
}
