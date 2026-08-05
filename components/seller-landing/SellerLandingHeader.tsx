import { useState } from 'react'
import { Platform } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

const WHATSAPP_URL = 'https://wa.me/918448991181?text=Hi, I want to sell on Sheconomy'
const LOGO_URL =
  'https://zsaqrrzwygzwrlzgymxk.supabase.co/storage/v1/object/public/sheconomy-logo/80x80.png'

type SellerLandingHeaderProps = {
  onScrollToForm: () => void
}

export function SellerLandingHeader({ onScrollToForm }: SellerLandingHeaderProps) {
  const ui = useAppUi()
  const { isDesktop, safeTop } = useAppLayout()
  const [menuOpen, setMenuOpen] = useState(false)

  const openWhatsApp = () => {
    if (Platform.OS === 'web') {
      window.open(WHATSAPP_URL, '_blank')
    }
  }

  const handleScrollToForm = () => {
    onScrollToForm()
    setMenuOpen(false)
  }

  return (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      top={0}
      left={0}
      right={0}
      zIndex={1000}
      backgroundColor={ui.background}
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      paddingTop={safeTop}
      style={
        Platform.OS === 'web'
          ? ({
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            } as React.CSSProperties)
          : undefined
      }
    >
      <XStack
        maxWidth={1200}
        alignSelf="center"
        width="100%"
        paddingHorizontal={isDesktop ? '$8' : '$4'}
        height={isDesktop ? 64 : 56}
        alignItems="center"
        justifyContent="space-between"
      >
        {/* Logo */}
        {Platform.OS === 'web' ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img
            src={LOGO_URL}
            width={isDesktop ? 40 : 36}
            height={isDesktop ? 40 : 36}
            style={{ borderRadius: 8, objectFit: 'cover' }}
            alt="SHEconomy"
          />
        ) : (
          <YStack
            width={36}
            height={36}
            borderRadius={8}
            backgroundColor={ui.roseSurface}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontWeight="900" color={ui.brand} fontSize={16}>
              S
            </Text>
          </YStack>
        )}

        {/* Desktop nav */}
        {isDesktop ? (
          <XStack alignItems="center" gap="$3">
            <Button
              chromeless
              size="$3"
              borderRadius={radius.pill}
              onPress={openWhatsApp}
            >
              <XStack alignItems="center" gap="$1.5">
                <Icons.MessageCircle size={16} color={ui.textSecondary} />
                <Text fontSize={13} fontWeight="600" color={ui.textSecondary}>
                  WhatsApp
                </Text>
              </XStack>
            </Button>

            <Button
              tone="primary"
              size="$3"
              borderRadius={radius.pill}
              onPress={handleScrollToForm}
            >
              <Text fontSize={13} fontWeight="700" color="white">
                Apply Now
              </Text>
            </Button>
          </XStack>
        ) : (
          // Mobile: hamburger
          <XStack
            width={40}
            height={40}
            alignItems="center"
            justifyContent="center"
            borderRadius={8}
            onPress={() => setMenuOpen((p) => !p)}
            cursor="pointer"
            pressStyle={{ opacity: 0.7 }}
          >
            {menuOpen ? (
              <Icons.X size={22} color={ui.text} />
            ) : (
              <Icons.Menu size={22} color={ui.text} />
            )}
          </XStack>
        )}
      </XStack>

      {/* Mobile dropdown menu */}
      {!isDesktop && menuOpen && (
        <YStack
          paddingHorizontal="$4"
          paddingBottom="$3"
          borderTopWidth={1}
          borderTopColor={ui.borderSubtle}
          gap="$2"
        >
          <Button
            chromeless
            size="$4"
            borderRadius={radius.card}
            onPress={openWhatsApp}
          >
            <XStack alignItems="center" gap="$2">
              <Icons.MessageCircle size={18} color={ui.textSecondary} />
              <Text fontSize={14} fontWeight="600" color={ui.textSecondary}>
                Chat on WhatsApp
              </Text>
            </XStack>
          </Button>

          <Button
            tone="primary"
            size="$4"
            borderRadius={radius.card}
            onPress={handleScrollToForm}
          >
            <Text fontSize={14} fontWeight="700" color="white">
              Apply as Seller
            </Text>
          </Button>
        </YStack>
      )}
    </YStack>
  )
}
