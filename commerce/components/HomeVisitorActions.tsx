import { useEffect, useState, type ReactNode } from 'react'
import { Linking, Platform, Share } from 'react-native'

import { PageSection } from '~/components/layout'
import {
  Button,
  Icons,
  Paragraph,
  Text,
  Theme,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { BRAND_NAME } from '~/config/brand'
import { BRAND_THEME, getShadowStyle } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from '~/lib/platform/open-in-app'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { ensureReferralCode, getInviteShareUrl } from '~/lib/referral/invite'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useSupabase } from '~/providers/SupabaseProvider'

/**
 * Web home actions: store listings for every visitor, invite share for members.
 * Native apps already are the store install, so this row stays off those builds.
 */
export function HomeVisitorActions() {
  const ui = useAppUi()
  const toast = useAppToast()
  const { hasSideRails, gutter } = useAppLayout()
  const { user } = useSupabase()
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  useEffect(() => {
    if (Platform.OS !== 'web' || !user?.id) {
      setInviteCode(null)
      return
    }
    let cancelled = false
    void ensureReferralCode(user.id).then((result) => {
      if (!cancelled && result.code) setInviteCode(result.code)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  if (Platform.OS !== 'web') return null

  async function shareInvite() {
    if (!inviteCode) return
    const url = getInviteShareUrl(inviteCode)
    const message = `Join me on ${BRAND_NAME} with my invite code ${inviteCode}\n${url}`
    try {
      await Share.share({ title: `${BRAND_NAME} invite`, message, url })
    } catch {
      const copied = await copyToClipboard(url)
      toast.show(copied ? 'Invite link copied' : 'Could not share invite', {
        tone: copied ? 'success' : 'danger',
      })
    }
  }

  return (
    <PageSection bleed paddingTop="$3" paddingBottom="$1" width="100%" alignSelf="stretch">
      <YStack
        width="100%"
        maxWidth="100%"
        alignSelf="stretch"
        borderTopWidth={1}
        borderBottomWidth={1}
        borderColor={ui.borderSubtle}
        overflow="hidden"
        style={{
          backgroundColor: ui.roseSurface,
          ...(Platform.OS === 'web'
            ? {
                background: `linear-gradient(105deg, ${ui.roseSurface} 0%, ${ui.surface} 48%, ${ui.surfaceMuted} 100%)`,
              }
            : null),
        }}
      >
        <YStack
          width="100%"
          paddingHorizontal={gutter}
          paddingVertical={hasSideRails ? '$5' : '$4'}
          gap={hasSideRails ? '$4' : '$3.5'}
        >
          <YStack gap="$1.5" width="100%" maxWidth={720}>
            <Text
              fontWeight="800"
              fontSize={hasSideRails ? 24 : 20}
              color={ui.text}
              letterSpacing={-0.45}
              lineHeight={hasSideRails ? 30 : 26}
            >
              Shop on iPhone or Android
            </Text>
            <Paragraph color={ui.textSecondary} fontSize={15} lineHeight={22}>
              Browse women-led shops, track orders, and check out faster in the {BRAND_NAME} app.
            </Paragraph>
          </YStack>

          <XStack
            width="100%"
            gap="$3"
            flexWrap={hasSideRails ? 'nowrap' : 'wrap'}
            alignItems="stretch"
          >
            <StoreDownloadTile
              title="iPhone"
              subtitle="Download on the App Store"
              badge="App Store"
              icon={<AppStoreMark />}
              tone="dark"
              onPress={() => void Linking.openURL(IOS_APP_STORE_URL)}
              flex={1}
              minWidth={hasSideRails ? 0 : '100%'}
            />
            <StoreDownloadTile
              title="Android"
              subtitle="Get it on Google Play"
              badge="Google Play"
              icon={<PlayStoreMark />}
              tone="brand"
              onPress={() => void Linking.openURL(ANDROID_PLAY_STORE_URL)}
              flex={1}
              minWidth={hasSideRails ? 0 : '100%'}
            />
            {user && inviteCode ? (
              <YStack
                flex={hasSideRails ? 0.85 : undefined}
                width={hasSideRails ? undefined : '100%'}
                minWidth={hasSideRails ? 200 : '100%'}
                justifyContent="center"
              >
                <Theme name={BRAND_THEME}>
                  <Button
                    size="$5"
                    tone="outline"
                    borderRadius={14}
                    width="100%"
                    height="100%"
                    minHeight={88}
                    backgroundColor={ui.surface}
                    borderColor={ui.brand}
                    icon={<Icons.Share2 size={18} color={ui.brand} />}
                    onPress={() => void shareInvite()}
                    accessibilityLabel="Share your invite"
                  >
                    Invite friends
                  </Button>
                </Theme>
              </YStack>
            ) : null}
          </XStack>
        </YStack>
      </YStack>
    </PageSection>
  )
}

function AppStoreMark() {
  if (Platform.OS !== 'web') {
    return <Icons.Smartphone size={22} color="#fff" />
  }
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden fill="#fff">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function PlayStoreMark() {
  return <Icons.Play size={22} color="#fff" />
}

function StoreDownloadTile({
  title,
  subtitle,
  badge,
  icon,
  tone,
  onPress,
  flex,
  minWidth,
}: {
  title: string
  subtitle: string
  badge: string
  icon: ReactNode
  tone: 'dark' | 'brand'
  onPress: () => void
  flex?: number
  minWidth?: number | string
}) {
  const ui = useAppUi()
  const isDark = tone === 'dark'
  const background = isDark ? '#111111' : ui.brand
  const hoverBg = isDark ? '#222222' : ui.brandDark

  return (
    <XStack
      flex={flex}
      minWidth={minWidth as never}
      alignItems="center"
      gap="$3.5"
      paddingVertical="$3.5"
      paddingHorizontal="$4"
      borderRadius={16}
      cursor="pointer"
      backgroundColor={background}
      pressStyle={{ opacity: 0.92, scale: 0.99 }}
      hoverStyle={{ backgroundColor: hoverBg }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${subtitle} — ${title}`}
      style={Platform.OS === 'web' ? getShadowStyle('sm') : undefined}
    >
      <YStack
        width={48}
        height={48}
        borderRadius={14}
        alignItems="center"
        justifyContent="center"
        backgroundColor="rgba(255,255,255,0.14)"
        flexShrink={0}
      >
        {icon}
      </YStack>
      <YStack flex={1} minWidth={0} gap={2}>
        <Text fontSize={11} fontWeight="700" color="rgba(255,255,255,0.72)" letterSpacing={0.6}>
          {badge.toUpperCase()}
        </Text>
        <Text fontSize={17} fontWeight="800" color="#fff" letterSpacing={-0.3} numberOfLines={1}>
          {title}
        </Text>
        <Text fontSize={13} fontWeight="500" color="rgba(255,255,255,0.82)" numberOfLines={1}>
          {subtitle}
        </Text>
      </YStack>
      <Icons.ChevronRight size={18} color="rgba(255,255,255,0.75)" />
    </XStack>
  )
}
