import { Link } from 'one'
import { Linking } from 'react-native'

import { Icons, Separator, Text, XStack, YStack } from '~/components/ui'
import { BRAND_NAME, BRAND_SOCIAL } from '~/config/brand'

import { COMMERCE_FOOTER_COLUMNS, COMMERCE_FOOTER_LEGAL } from './config'
import { NavLogo } from '~/components/navigation/NavLogo'
import { commerceRoutes } from '~/lib/routes'
import { useAppUi } from '~/lib/theme/useAppUi'

export function CommerceDesktopFooter() {
  const ui = useAppUi()

  return (
    <YStack
      backgroundColor={ui.panelBg}
      borderTopWidth={1}
      borderTopColor={ui.panelBorder}
      width="100%"
      flexShrink={0}
    >
      <XStack
        width="100%"
        paddingHorizontal="$5"
        paddingVertical="$8"
        gap="$8"
        flexWrap="wrap"
      >
        <YStack flex={1} minWidth={220} gap="$4">
          <NavLogo href={commerceRoutes.home} />
          <Text color={ui.textSecondary} fontSize={13} lineHeight={20} maxWidth={280}>
            A women-led commerce platform to discover unique shops, buy with confidence, and grow your
            business — inspired by the best of handmade commerce.
          </Text>
          <XStack gap="$3">
            <FooterSocial icon={Icons.Instagram} label="Instagram" href={BRAND_SOCIAL.instagram} />
            <FooterSocial icon={Icons.Facebook} label="Facebook" href={BRAND_SOCIAL.facebook} />
            <FooterSocial icon={Icons.Twitter} label="Twitter" href={BRAND_SOCIAL.twitter} />
          </XStack>
        </YStack>

        {COMMERCE_FOOTER_COLUMNS.map((column) => (
          <YStack key={column.title} minWidth={140} gap="$3" flex={1}>
            <Text fontWeight="500" fontSize={14} color={ui.text}>
              {column.title}
            </Text>
            {column.links.map((link) => (
              <Link key={`${column.title}-${link.label}`} href={link.href} asChild>
                <Text
                  fontSize={13}
                  color={ui.textSecondary}
                  cursor="pointer"
                  hoverStyle={{ textDecorationLine: 'underline', color: ui.text }}
                >
                  {link.label}
                </Text>
              </Link>
            ))}
          </YStack>
        ))}
      </XStack>

      <Separator backgroundColor={ui.panelBorder} />

      <XStack
        width="100%"
        paddingHorizontal="$5"
        paddingVertical="$4"
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap="$3"
      >
        <Text fontSize={12} color={ui.textMuted}>
          © {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.
        </Text>
        <XStack gap="$4" flexWrap="wrap">
          {COMMERCE_FOOTER_LEGAL.map((link) => (
            <Link key={link.label} href={link.href} asChild>
              <Text
                fontSize={12}
                color={ui.textMuted}
                cursor="pointer"
                hoverStyle={{ color: ui.text, textDecorationLine: 'underline' }}
              >
                {link.label}
              </Text>
            </Link>
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
      backgroundColor={ui.panelBorder}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.borderSubtle }}
      pressStyle={{ scale: 0.96 }}
      aria-label={label}
      onPress={() => {
        void Linking.openURL(href)
      }}
    >
      <Icon size={18} color={ui.text} />
    </XStack>
  )
}
