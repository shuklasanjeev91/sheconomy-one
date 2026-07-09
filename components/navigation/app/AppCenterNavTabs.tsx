import { Link, usePathname } from 'one'

import { XStack, YStack } from '~/components/ui'
import { useAccess } from '~/hooks/useAccess'
import { useAppUi } from '~/lib/theme/useAppUi'

import { APP_CENTER_NAV, getAppColors } from './config'

type AppCenterNavTabsProps = {
  variant?: 'desktop' | 'mobile' | 'mobile-inline'
}

export function AppCenterNavTabs({ variant = 'desktop' }: AppCenterNavTabsProps) {
  const pathname = usePathname()
  const { resolveFeatureNavHref } = useAccess()
  const ui = useAppUi()
  const colors = getAppColors(ui)
  const isInline = variant === 'mobile-inline'
  const isMobile = variant === 'mobile' || isInline

  return (
    <XStack
      flex={isInline ? 1 : undefined}
      width={isInline ? undefined : '100%'}
      minWidth={isInline ? 0 : undefined}
      justifyContent={isInline ? 'space-evenly' : 'space-around'}
      alignItems="stretch"
      alignSelf="stretch"
      borderTopWidth={variant === 'mobile' ? 1 : 0}
      borderTopColor={colors.border}
      paddingHorizontal={variant === 'mobile' ? 4 : 0}
    >
      {APP_CENTER_NAV.map((item) => {
        const isActive = item.match(pathname)
        const Icon = item.icon
        const href = resolveFeatureNavHref(String(item.href), item.feature)

        return (
          <Link key={item.label} href={href} asChild>
            <YStack
              flex={isInline ? 1 : 1}
              maxWidth={!isMobile ? 112 : undefined}
              alignItems="center"
              justifyContent="center"
              cursor="pointer"
              position="relative"
              height={isMobile ? (isInline ? 44 : 48) : undefined}
              hoverStyle={isMobile ? undefined : { backgroundColor: ui.navHover }}
              pressStyle={isMobile ? { opacity: 0.7 } : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <Icon
                size={isInline ? 20 : isMobile ? 22 : 24}
                color={isActive ? colors.brand : colors.icon}
                fill={isActive ? colors.brand : 'none'}
              />
              {isActive ? (
                <YStack
                  position="absolute"
                  bottom={0}
                  left={isInline ? '12%' : isMobile ? '18%' : '8%'}
                  right={isInline ? '12%' : isMobile ? '18%' : '8%'}
                  height={3}
                  backgroundColor={colors.brand}
                  borderTopLeftRadius={3}
                  borderTopRightRadius={3}
                />
              ) : null}
            </YStack>
          </Link>
        )
      })}
    </XStack>
  )
}