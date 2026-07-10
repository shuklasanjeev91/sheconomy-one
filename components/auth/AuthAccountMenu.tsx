import { Link, useRouter } from 'one'
import type { Href } from 'one'

import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { commerceRoutes, routes } from '~/lib/routes'
import { useAccess } from '~/hooks/useAccess'
import { useAuth } from '~/hooks/useAuth'
import { useProfile } from '~/hooks/useProfile'
import { useAppUi } from '~/lib/theme/useAppUi'

type AuthUserMenuContentProps = {
  onClose: () => void
}

type MenuItem = {
  icon: typeof Icons.User
  label: string
  href?: Href
  onPress?: () => void
  tone?: 'default' | 'danger'
}

export function AuthUserMenuContent({ onClose }: AuthUserMenuContentProps) {
  const ui = useAppUi()
  const router = useRouter()
  const { profile } = useProfile()
  const { isMale } = useAccess()
  const { signOut } = useAuth()

  const displayName = profile?.full_name || profile?.username || 'Your account'
  const profileHref = isMale
    ? routes.verifyGender
    : profile?.username
      ? routes.userProfile(profile.username)
      : routes.profile

  const items: MenuItem[] = [
    { icon: Icons.User, label: 'View profile', href: profileHref },
    { icon: Icons.Settings, label: 'Settings', href: routes.settings },
    { icon: Icons.Store, label: 'Seller hub', href: commerceRoutes.myShops },
  ]

  items.push({
    icon: Icons.LogOut,
    label: 'Sign out',
    tone: 'danger',
    onPress: () => {
      void signOut()
      onClose()
    },
  })

  function go(href: Href) {
    onClose()
    router.push(href)
  }

  return (
    <YStack gap="$1" minWidth={240}>
      <XStack gap="$3" alignItems="center" paddingHorizontal="$2" paddingVertical="$2">
        <Avatar name={displayName} src={profile?.avatar_url ?? undefined} size="$4" />
        <YStack flex={1} minWidth={0} gap={2}>
          <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={1}>
            {displayName}
          </Text>
          {profile?.username ? (
            <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
              @{profile.username}
            </Text>
          ) : profile?.email ? (
            <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
              {profile.email}
            </Text>
          ) : null}
        </YStack>
      </XStack>

      <YStack height={1} backgroundColor={ui.borderSubtle} marginVertical="$1" />

      {items.map((item) => (
        <MenuRow
          key={item.label}
          icon={item.icon}
          label={item.label}
          tone={item.tone}
          onPress={() => {
            if (item.onPress) {
              item.onPress()
              return
            }
            if (item.href) go(item.href)
          }}
        />
      ))}
    </YStack>
  )
}

function MenuRow({
  icon: Icon,
  label,
  onPress,
  tone = 'default',
}: {
  icon: typeof Icons.User
  label: string
  onPress: () => void
  tone?: 'default' | 'danger'
}) {
  const ui = useAppUi()
  const color = tone === 'danger' ? ui.danger : ui.text
  const iconColor = tone === 'danger' ? ui.danger : ui.textSecondary

  return (
    <XStack
      gap="$3"
      alignItems="center"
      paddingVertical="$2.5"
      paddingHorizontal="$2"
      borderRadius={10}
      cursor="pointer"
      animation="quick"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      pressStyle={{ opacity: 0.85 }}
      onPress={onPress}
    >
      <Icon size={20} color={iconColor} />
      <Text fontSize={15} fontWeight="500" color={color}>
        {label}
      </Text>
    </XStack>
  )
}

export function AuthGuestMenuContent({ onClose, signInHref }: { onClose: () => void; signInHref: Href }) {
  const ui = useAppUi()

  return (
    <YStack gap="$3" paddingBottom="$2">
      <YStack gap="$1" paddingHorizontal="$2">
        <Text fontSize={18} fontWeight="800" color={ui.text} letterSpacing={-0.3}>
          Welcome
        </Text>
        <Text fontSize={14} color={ui.textMuted} lineHeight={21}>
          Sign in to access your profile, shops, and community.
        </Text>
      </YStack>
      <Link href={signInHref} asChild>
        <XStack
          height={48}
          borderRadius={999}
          backgroundColor={ui.brand}
          alignItems="center"
          justifyContent="center"
          marginHorizontal="$2"
          cursor="pointer"
          animation="quick"
          pressStyle={{ opacity: 0.9, scale: 0.98 }}
          onPress={onClose}
        >
          <Text fontSize={15} fontWeight="700" color={ui.onBrand}>
            Sign in
          </Text>
        </XStack>
      </Link>
    </YStack>
  )
}
