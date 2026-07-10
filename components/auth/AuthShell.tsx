import type { ReactNode } from 'react'
import { useState } from 'react'
import { Platform } from 'react-native'

import { AuthBenefitsCarousel } from '~/components/auth/AuthBenefitsCarousel'
import { AuthBrandLogo } from '~/components/auth/AuthBrandLogo'
import { AuthOnboarding } from '~/components/auth/AuthOnboarding'
import { AUTH_COPY } from '~/components/auth/auth-copy'
import { AUTH_LAYOUT, authHeroStyle, authPageStyle, authViewportStyle, useAuthLayout } from '~/components/auth/auth-layout'
import { AuthBackButton } from '~/components/auth/AuthBackButton'
import {
  PageRail,
} from '~/components/layout'
import { Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { APP_LAYOUT } from '~/lib/layout/constants'
import { elevatedCardStyle } from '~/lib/theme/surfaces'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAuthDesktopLayout } from '~/hooks/useAuthDesktopLayout'
import { useAppUi, useIsDarkTheme } from '~/lib/theme/useAppUi'
import { useThemedShadowStyle } from '~/lib/theme/useThemedShadowStyle'

function DesktopAuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <YStack flex={1} width="100%" height="100%" minHeight={0} overflow="hidden" style={authViewportStyle()}>
      <XStack flex={1} width="100%" height="100%" alignItems="stretch" overflow="hidden">
        <YStack flex={1} width="50%" maxWidth="50%" height="100%" minHeight={0} minWidth={0}>
          <DesktopMarketingPanel />
        </YStack>
        <DesktopAuthFormColumn footer={footer}>{children}</DesktopAuthFormColumn>
      </XStack>
    </YStack>
  )
}

type AuthShellProps = {
  children: ReactNode
  footer?: ReactNode
}

function TrustBadges({ light = false }: { light?: boolean }) {
  const layout = useAuthLayout()
  const ui = useAppUi()

  return (
    <XStack gap="$2" flexWrap="wrap">
      {AUTH_COPY.trustBadges.map((label) => (
        <XStack
          key={label}
          alignItems="center"
          gap={6}
          paddingVertical={6}
          paddingHorizontal={12}
          borderRadius={AUTH_LAYOUT.pillRadius}
          backgroundColor={light ? layout.glassBg : ui.chip}
          borderWidth={1}
          borderColor={light ? layout.glassBorder : ui.borderSubtle}
        >
          <Icons.ShieldCheck size={14} color={light ? 'white' : ui.brand} />
          <Text fontSize={12} fontWeight="700" color={light ? layout.trustText : ui.text} letterSpacing={0.15}>
            {label}
          </Text>
        </XStack>
      ))}
    </XStack>
  )
}

function AuthFormCard({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const ui = useAppUi()
  const isDark = useIsDarkTheme()
  const shadow = useThemedShadowStyle('md')
  const layout = useAuthLayout()

  return (
    <YStack
      width="100%"
      borderRadius={AUTH_LAYOUT.cardRadius}
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      padding="$5"
      gap="$4"
      style={{
        ...elevatedCardStyle(ui, 'md', isDark ? 'dark' : 'light'),
        ...(Platform.OS === 'web' ? { boxShadow: layout.formShadow } : shadow),
      }}
    >
      {children}
      {footer}
    </YStack>
  )
}

function DesktopMarketingPanel() {
  const layout = useAuthLayout()
  const { gutter } = useAppLayout()

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      minHeight={0}
      padding={gutter}
      paddingVertical="$8"
      justifyContent="space-between"
      gap="$6"
      overflow="hidden"
      position="relative"
      style={authHeroStyle(layout, 'desktop')}
    >
      <YStack gap="$6" zIndex={1} width="100%" maxWidth="100%">
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <AuthBrandLogo />
          <AuthBackButton variant="light" />
        </XStack>
        <YStack gap="$3">
          <Text color="white" fontSize={36} fontWeight="800" lineHeight={42} letterSpacing={-1}>
            {AUTH_COPY.heroHeadline}
          </Text>
          <Text color={layout.trustText} fontSize={16} lineHeight={25}>
            {AUTH_COPY.heroSubline}
          </Text>
        </YStack>
        <TrustBadges light />
        <AuthBenefitsCarousel />
      </YStack>
      <Text color={layout.trustMuted} fontSize={13} lineHeight={20} zIndex={1}>
        Trusted by women entrepreneurs across India — secure access, real community, real growth.
      </Text>
    </YStack>
  )
}

function MobileAuthFormView({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const ui = useAppUi()
  const { gutter, safeTop, safeBottom } = useAppLayout()

  return (
    <YStack
      flex={1}
      width="100%"
      height="100%"
      minHeight={0}
      backgroundColor={ui.background}
      style={authViewportStyle()}
    >
      <ScrollView
        flex={1}
        width="100%"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: gutter,
          paddingTop: Math.max(safeTop, 12),
          paddingBottom: Math.max(safeBottom, 20) + 8,
        }}
      >
        <XStack justifyContent="flex-end" width="100%" marginBottom="$2">
          <AuthBackButton showLabel={false} />
        </XStack>
        <YStack alignItems="center" width="100%" paddingVertical="$3" marginBottom="$2">
          <AuthBrandLogo />
        </YStack>
        <PageRail maxWidth={APP_LAYOUT.maxFormWidth} centered gap="$4" width="100%" alignSelf="center">
          <YStack gap="$1" width="100%">
            <Text fontSize={22} fontWeight="800" color={ui.text} letterSpacing={-0.4} textAlign="center">
              {AUTH_COPY.title}
            </Text>
            <Text fontSize={14} color={ui.textMuted} lineHeight={21} textAlign="center">
              {AUTH_COPY.subtitle}
            </Text>
          </YStack>
          <AuthFormCard footer={footer}>{children}</AuthFormCard>
        </PageRail>
      </ScrollView>
    </YStack>
  )
}

function DesktopAuthFormColumn({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const ui = useAppUi()
  const layout = useAuthLayout()
  const { gutter } = useAppLayout()

  return (
    <YStack
      flex={1}
      width="50%"
      maxWidth="50%"
      height="100%"
      minHeight={0}
      backgroundColor={ui.background}
      style={authPageStyle(layout)}
    >
      <ScrollView
        flex={1}
        width="100%"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: gutter,
          paddingVertical: 32,
        }}
      >
        <PageRail maxWidth={APP_LAYOUT.maxFormWidth} centered gap="$5" width="100%" alignSelf="center">
          <YStack gap="$1.5" width="100%">
            <Text fontSize={30} fontWeight="800" color={ui.text} letterSpacing={-0.8} lineHeight={36}>
              {AUTH_COPY.title}
            </Text>
            <Text fontSize={15} color={ui.textMuted} lineHeight={23}>
              {AUTH_COPY.subtitle}
            </Text>
          </YStack>
          <AuthFormCard footer={footer}>{children}</AuthFormCard>
        </PageRail>
      </ScrollView>
    </YStack>
  )
}

/** Full-screen auth shell — desktop 50/50 split; mobile/tablet onboarding then form. */
export function AuthShell({ children, footer }: AuthShellProps) {
  const isDesktopLayout = useAuthDesktopLayout()
  const [onboardingComplete, setOnboardingComplete] = useState(false)

  if (isDesktopLayout) {
    return <DesktopAuthLayout footer={footer}>{children}</DesktopAuthLayout>
  }

  if (!onboardingComplete) {
    return <AuthOnboarding onFinish={() => setOnboardingComplete(true)} />
  }

  return <MobileAuthFormView footer={footer}>{children}</MobileAuthFormView>
}
