import type { ReactNode } from 'react'

import { AuthBackButton } from '~/components/auth/AuthBackButton'
import { AuthBenefitsCarousel } from '~/components/auth/AuthBenefitsCarousel'
import { AUTH_COPY } from '~/components/auth/auth-copy'
import { useAuthUi } from '~/components/auth/auth-theme'
import { FullWidthLayout, PageRail, PageSection, ScreenFill } from '~/components/layout'
import { Icons, Image, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { APP_LAYOUT } from '~/lib/layout/constants'
import { getSheconomyLogoUrl } from '~/lib/supabase/brand'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

type AuthScreenProps = {
  children: ReactNode
  footer?: ReactNode
}

function BrandMark({
  color,
  subtitleColor,
  compact = false,
  showSubtitle = false,
}: {
  color: string
  subtitleColor?: string
  compact?: boolean
  showSubtitle?: boolean
}) {
  const authUi = useAuthUi()
  const size = compact ? 40 : 52
  const logo = compact ? 30 : 38

  return (
    <XStack alignItems="center" gap={compact ? '$2.5' : '$3'}>
      <YStack
        width={size}
        height={size}
        borderRadius={compact ? 14 : 16}
        backgroundColor={compact ? authUi.chipBg : authUi.glassBg}
        borderWidth={compact ? 1 : 0}
        borderColor={compact ? authUi.chipBorder : authUi.glassBorder}
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
      >
        <Image
          source={{ uri: getSheconomyLogoUrl('icon') }}
          width={logo}
          height={logo}
          resizeMode="contain"
        />
      </YStack>
      <YStack gap={2}>
        <Text fontSize={compact ? 20 : 26} fontWeight="800" color={color} letterSpacing={-0.6}>
          {BRAND_NAME}
        </Text>
        {showSubtitle ? (
          <Text fontSize={12} fontWeight="600" color={subtitleColor ?? authUi.trustMuted} letterSpacing={0.6}>
            WOMEN&apos;S ECONOMY PLATFORM
          </Text>
        ) : null}
      </YStack>
    </XStack>
  )
}

function TrustBadges({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const authUi = useAuthUi()
  const ui = useAppUi()
  const isLight = variant === 'light'

  return (
    <XStack gap="$2" flexWrap="wrap">
      {AUTH_COPY.trustBadges.map((label) => (
        <XStack
          key={label}
          alignItems="center"
          gap={6}
          paddingVertical={6}
          paddingHorizontal={12}
          borderRadius={authUi.pillRadius}
          backgroundColor={isLight ? authUi.glassBg : authUi.chipBg}
          borderWidth={1}
          borderColor={isLight ? authUi.glassBorder : authUi.chipBorder}
        >
          <Icons.ShieldCheck size={14} color={isLight ? 'white' : ui.brand} />
          <Text
            fontSize={12}
            fontWeight="700"
            color={isLight ? authUi.trustText : authUi.chipText}
            letterSpacing={0.2}
          >
            {label}
          </Text>
        </XStack>
      ))}
    </XStack>
  )
}

function FormCard({
  children,
  footer,
  ui,
  elevated = false,
}: {
  children: ReactNode
  footer?: ReactNode
  ui: ReturnType<typeof useAppUi>
  elevated?: boolean
}) {
  const authUi = useAuthUi()
  return (
    <YStack
      width="100%"
      maxWidth="100%"
      borderRadius={authUi.cardRadius}
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      padding="$5"
      gap="$4"
      style={elevated ? { boxShadow: authUi.formShadow } : undefined}
    >
      {children}
      {footer}
    </YStack>
  )
}

function AuthFormHeader({ ui }: { ui: ReturnType<typeof useAppUi> }) {
  return (
    <YStack gap="$2">
      <Text fontSize={30} fontWeight="800" color={ui.text} letterSpacing={-0.8} lineHeight={36}>
        {AUTH_COPY.title}
      </Text>
      <Text fontSize={15} color={ui.textMuted} lineHeight={23} maxWidth={420}>
        {AUTH_COPY.subtitle}
      </Text>
    </YStack>
  )
}

function MobileHero() {
  const authUi = useAuthUi()
  return (
    <PageSection bleed paddingTop="$5" paddingBottom="$8" gap="$4" overflow="hidden" position="relative">
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        pointerEvents="none"
        style={{ backgroundImage: `${authUi.heroMesh}, ${authUi.heroGradient}` }}
      />
      <YStack
        position="absolute"
        top={-40}
        right={-30}
        width={180}
        height={180}
        borderRadius={999}
        backgroundColor="rgba(255,255,255,0.08)"
        pointerEvents="none"
      />
      <YStack
        position="absolute"
        bottom={-60}
        left={-40}
        width={220}
        height={220}
        borderRadius={999}
        backgroundColor="rgba(248,120,64,0.12)"
        pointerEvents="none"
      />

      <XStack alignItems="center" justifyContent="space-between" gap="$3" zIndex={1}>
        <BrandMark color="white" subtitleColor={authUi.trustMuted} showSubtitle compact />
        <AuthBackButton variant="light" showLabel={false} />
      </XStack>

      <YStack gap="$2" zIndex={1} maxWidth={360}>
        <Text color="white" fontSize={24} fontWeight="800" lineHeight={30} letterSpacing={-0.5}>
          {AUTH_COPY.heroHeadline}
        </Text>
        <Text color={authUi.trustText} fontSize={14} lineHeight={21}>
          {AUTH_COPY.heroSubline}
        </Text>
      </YStack>

      <YStack zIndex={1}>
        <TrustBadges variant="light" />
      </YStack>
    </PageSection>
  )
}

function DesktopBenefitsPanel() {
  const authUi = useAuthUi()
  return (
    <YStack
      flex={1.05}
      minWidth={0}
      minHeight={640}
      borderRadius={28}
      padding="$7"
      justifyContent="space-between"
      gap="$6"
      overflow="hidden"
      position="relative"
      style={{
        backgroundImage: `${authUi.heroMesh}, ${authUi.heroGradient}`,
        boxShadow: authUi.heroGlow,
      }}
    >
      <YStack
        position="absolute"
        top={-80}
        right={-60}
        width={280}
        height={280}
        borderRadius={999}
        backgroundColor="rgba(255,255,255,0.1)"
        pointerEvents="none"
      />
      <YStack
        position="absolute"
        bottom={-100}
        left={-80}
        width={320}
        height={320}
        borderRadius={999}
        backgroundColor="rgba(248,120,64,0.14)"
        pointerEvents="none"
      />

      <YStack gap="$6" zIndex={1}>
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <BrandMark color="white" subtitleColor={authUi.trustMuted} showSubtitle />
          <AuthBackButton variant="light" />
        </XStack>

        <YStack gap="$3" maxWidth={520}>
          <Text color="white" fontSize={38} fontWeight="800" lineHeight={44} letterSpacing={-1}>
            {AUTH_COPY.heroHeadline}
          </Text>
          <Text color={authUi.trustText} fontSize={17} lineHeight={26}>
            {AUTH_COPY.heroSubline}
          </Text>
        </YStack>

        <TrustBadges variant="light" />
        <AuthBenefitsCarousel />
      </YStack>

      <Text color={authUi.trustMuted} fontSize={13} lineHeight={20} zIndex={1}>
        Trusted by women entrepreneurs across India — secure access, real community, real growth.
      </Text>
    </YStack>
  )
}

function AuthFormColumn({
  children,
  footer,
  ui,
  elevated = false,
  showHeader = true,
}: {
  children: ReactNode
  footer?: ReactNode
  ui: ReturnType<typeof useAppUi>
  elevated?: boolean
  showHeader?: boolean
}) {
  return (
    <PageRail maxWidth={APP_LAYOUT.maxFormWidth} centered gap="$5">
      {showHeader ? <AuthFormHeader ui={ui} /> : null}
      <FormCard ui={ui} footer={footer} elevated={elevated}>
        {children}
      </FormCard>
    </PageRail>
  )
}

export function AuthScreen({ children, footer }: AuthScreenProps) {
  const authUi = useAuthUi()
  const ui = useAppUi()
  const { isDesktop } = useAppLayout()

  if (!isDesktop) {
    return (
      <FullWidthLayout scroll>
        <MobileHero />
        <PageSection marginTop={-28} paddingBottom="$8" zIndex={2}>
          <AuthFormColumn ui={ui} footer={footer} elevated showHeader={false}>
              <YStack gap="$1" marginBottom="$1">
                <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4}>
                  {AUTH_COPY.title}
                </Text>
                <Text fontSize={14} color={ui.textMuted} lineHeight={20}>
                  {AUTH_COPY.subtitle}
                </Text>
              </YStack>
              {children}
            </AuthFormColumn>
        </PageSection>
      </FullWidthLayout>
    )
  }

  return (
    <ScreenFill
      alignItems="center"
      justifyContent="center"
      paddingVertical="$8"
      paddingHorizontal="$6"
      style={{ backgroundImage: authUi.pageGradient }}
    >
      <PageRail maxWidth={APP_LAYOUT.maxAuthWidth} centered width="100%">
        <XStack width="100%" gap="$6" alignItems="stretch">
          <DesktopBenefitsPanel />
          <YStack flex={1} minWidth={0} justifyContent="center" paddingVertical="$4">
            <AuthFormColumn ui={ui} footer={footer} elevated>
              {children}
            </AuthFormColumn>
          </YStack>
        </XStack>
      </PageRail>
    </ScreenFill>
  )
}