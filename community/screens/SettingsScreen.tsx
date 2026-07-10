import { useUserScheme } from '@vxrn/color-scheme'
import { useState } from 'react'

import { CommunityShell } from '~/community/components/CommunityShell'
import { CommunityPageHeader } from '~/community/components/CommunityPageHeader'
import { BRAND_BLUE } from '~/community/lib/constants'
import {
  Button,
  Icons,
  ListItem,
  RadioGroup,
  RadioGroupItemWithLabel,
  Separator,
  Switch,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { SurfaceCard } from '~/components/layout'
import { radius } from '~/config/tokens'
import { useAuth } from '~/hooks/useAuth'
import { useAppUi } from '~/lib/theme/useAppUi'

import { BRAND_NAME } from '~/config/brand'

export function SettingsScreen() {
  const ui = useAppUi()
  const scheme = useUserScheme()
  const toast = useAppToast()
  const { signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    const { error } = await signOut()
    setIsSigningOut(false)

    if (error) {
      toast.show('Sign out failed', { tone: 'danger', message: error })
      return
    }

    toast.show('Signed out', { tone: 'success' })
  }

  return (
    <CommunityShell>
      <YStack gap="$5" width="100%">
        <CommunityPageHeader
          title="Settings"
          subtitle={`Customize your ${BRAND_NAME} experience`}
        />

        <SettingsSection title="Appearance">
          <SurfaceCard padding="$4" gap="$4" borderRadius={radius.card}>
            <Text color={ui.textSecondary} fontSize={14}>
              Theme
            </Text>
            <RadioGroup value={scheme.setting} onValueChange={(v) => scheme.set(v as any)}>
              <RadioGroupItemWithLabel value="light" label="Light" />
              <RadioGroupItemWithLabel value="dark" label="Dark" />
              <RadioGroupItemWithLabel value="system" label="Match system" />
            </RadioGroup>
          </SurfaceCard>
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
            <PreferenceRow icon={Icons.Bell} title="Push notifications" defaultChecked />
            <Separator />
            <PreferenceRow icon={Icons.Mail} title="Email digest" />
            <Separator />
            <PreferenceRow icon={Icons.AtSign} title="Mentions and replies" defaultChecked />
            <Separator />
            <PreferenceRow icon={Icons.Users} title="Connection requests" defaultChecked />
          </SurfaceCard>
        </SettingsSection>

        <SettingsSection title="Privacy">
          <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
            <PreferenceRow icon={Icons.Eye} title="Profile visibility" subtitle="Public" />
            <Separator />
            <PreferenceRow icon={Icons.Fingerprint} title="Biometric unlock" defaultChecked />
          </SurfaceCard>
        </SettingsSection>

        <SettingsSection title="Account">
          <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
            <XStack
              alignItems="center"
              justifyContent="space-between"
              paddingHorizontal="$4"
              paddingVertical="$3"
            >
              <XStack gap="$3" alignItems="center" flex={1}>
                <Icons.LogOut size={18} color="$red10" />
                <Text fontWeight="600" color={ui.text}>
                  Sign out
                </Text>
              </XStack>
              <Button
                tone="outline"
                size="$3"
                disabled={isSigningOut}
                onPress={handleSignOut}
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </Button>
            </XStack>
          </SurfaceCard>
        </SettingsSection>

        <SettingsSection title="About">
          <SurfaceCard padding="$0" borderRadius={radius.card} overflow="hidden">
            <ListItem
              icon={<Icons.Info size={18} color={BRAND_BLUE} />}
              title="Version"
              subTitle="1.0.0"
            />
          </SurfaceCard>
        </SettingsSection>
      </YStack>
    </CommunityShell>
  )
}

function SettingsSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const ui = useAppUi()

  return (
    <YStack gap="$2.5">
      <XStack gap="$2.5" alignItems="center">
        <YStack width={3} height={18} borderRadius={999} backgroundColor={ui.brand} opacity={0.85} />
        <Text fontWeight="700" fontSize={15} color={ui.text} letterSpacing={-0.15}>
          {title}
        </Text>
      </XStack>
      {children}
    </YStack>
  )
}

function PreferenceRow({
  icon: Icon,
  title,
  subtitle,
  defaultChecked,
}: {
  icon: typeof Icons.Bell
  title: string
  subtitle?: string
  defaultChecked?: boolean
}) {
  const ui = useAppUi()

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      paddingHorizontal="$4"
      paddingVertical="$3.5"
      hoverStyle={{ backgroundColor: ui.navHover }}
    >
      <XStack alignItems="center" gap="$3" flex={1}>
        <Icon size={18} color={ui.textSecondary} />
        <YStack gap={2}>
          <Text fontSize={15} color={ui.text}>
            {title}
          </Text>
          {subtitle ? (
            <Text fontSize={13} color={ui.textMuted}>
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>
      <Switch defaultChecked={defaultChecked} />
    </XStack>
  )
}