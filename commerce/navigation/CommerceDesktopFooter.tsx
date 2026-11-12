import type { Href } from 'one'

import { RegionPreferencesTrigger } from '~/components/locale'
import { AppLink } from '~/components/navigation/AppLink'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME, BRAND_SOCIAL } from '~/config/brand'
import { NavLogo } from '~/components/navigation/NavLogo'
import { commerceRoutes } from '~/lib/routes'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useVendorShops } from '~/hooks/useVendorShops'
import { useAppUi, useIsDarkTheme } from '~/lib/theme/useAppUi'
import { openExternalUrl } from '~/lib/platform/openUrl'

import { COMMERCE_FOOTER_COLUMNS, COMMERCE_FOOTER_LEGAL } from '~/commerce/navigation/config'

/** Marketplace footer: link columns + dark locale/legal bar. */
export function CommerceDesktopFooter() {
  const ui = useAppUi()
  const isDark = useIsDarkTheme()
  const { gutter } = useAppLayout()
  const { primaryShopId } = useVendorShops()

  const barBg = isDark ? '#12080e' : '#2F2340'
  const barText = 'rgba(255, 255, 255, 0.88)'
  const barMuted = 'rgba(255, 255, 255, 0.62)'
  const barHover = '#ffffff'

  const sellerHubHref: Href = primaryShopId
    ? commerceRoutes.manageShop(primaryShopId)
    : commerceRoutes.createShop

  return (
    <YStack width="100%" flexShrink={0}>
      <YStack
        backgroundColor={ui.surfaceMuted}
        borderTopWidth={1}
        borderTopColor={ui.panelBorder}
        width="100%"
      >
        <XStack
          width="100%"
          maxWidth="100%"
          alignSelf="stretch"
          paddingHorizontal={gutter}
          paddingTop="$8"
          paddingBottom="$7"
          gap="$6"
          flexWrap="wrap"
        >
          <YStack flexBasis={200} flexGrow={1} flexShrink={1} minWidth={180} gap="$3" paddingRight="$4">
            <NavLogo href={commerceRoutes.home} />
            <Text color={ui.textSecondary} fontSize={13} lineHeight={20} maxWidth={260}>
              Discover independent shops, buy with confidence, and grow your business on{' '}
              {BRAND_NAME}.
            </Text>
            <XStack gap="$2" marginTop="$1">
              <FooterSocial icon={Icons.Instagram} label="Instagram" href={BRAND_SOCIAL.instagram} />
              <FooterSocial icon={Icons.Twitter} label="Twitter / X" href={BRAND_SOCIAL.twitter} />
            </XStack>
          </YStack>

          {COMMERCE_FOOTER_COLUMNS.map((column) => (
            <YStack key={column.title} flexBasis={140} flexGrow={1} flexShrink={1} minWidth={130} gap="$3">
              <Text fontWeight="700" fontSize={13} letterSpacing={0.4} color={ui.text}>
                {column.title}
              </Text>
              <YStack gap="$2">
                {column.links.map((link) => {
                  const href =
                    link.href === commerceRoutes.createShop || link.href === commerceRoutes.manageShop()
                      ? sellerHubHref
                      : link.href
                  return (
                    <AppLink key={`${column.title}-${link.label}`} href={href} asChild>
                      <Text
                        fontSize={13}
                        color={ui.textSecondary}
                        cursor="pointer"
                        hoverStyle={{ textDecorationLine: 'underline', color: ui.text }}
                      >
                        {link.label}
                      </Text>
                    </AppLink>
                  )
                })}
              </YStack>
            </YStack>
          ))}
        </XStack>
      </YStack>

      <XStack
        width="100%"
        backgroundColor={barBg}
        paddingHorizontal={gutter}
        paddingVertical="$3.5"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap="$3"
      >
        <XStack
          flex={1}
          minWidth={220}
          alignItems="center"
          gap="$3"
          flexWrap="wrap"
        >
          <RegionPreferencesTrigger variant="footerBar" />
          <Text fontSize={12} color={barMuted}>
            © {new Date().getFullYear()} {BRAND_NAME}
          </Text>
        </XStack>

        <XStack gap="$4" flexWrap="wrap" alignItems="center">
          {COMMERCE_FOOTER_LEGAL.map((link) => (
            <AppLink key={link.label} href={link.href} asChild>
              <Text
                fontSize={12}
                color={barText}
                cursor="pointer"
                hoverStyle={{ color: barHover, textDecorationLine: 'underline' }}
              >
                {link.label}
              </Text>
            </AppLink>
          ))}
        </XStack>
      </XStack>
    </YStack>
  )
}

function FooterSocial({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Icons.Instagram
  label: string
  href: string
}) {
  const ui = useAppUi()

  return (
    <XStack
      width={36}
      height={36}
      borderRadius={999}
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      pressStyle={{ scale: 0.96 }}
      aria-label={label}
      onPress={() => {
        void openExternalUrl(href)
      }}
    >
      <Icon size={18} color={ui.brand} />
    </XStack>
  )
}
