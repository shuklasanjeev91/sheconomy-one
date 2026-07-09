import { Link } from 'one'
import type { Href } from 'one'

import { Avatar, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type NavAccountLinkProps = {
  href: Href
  displayName?: string
  avatarUrl?: string | null
  isAuthenticated: boolean
}

/** Etsy-style account control — icon + label, avatar when signed in. */
export function NavAccountLink({
  href,
  displayName,
  avatarUrl,
  isAuthenticated,
}: NavAccountLinkProps) {
  const ui = useAppUi()
  const name = displayName || 'Account'

  return (
    <Link href={href} asChild>
      <YStack
        alignItems="center"
        justifyContent="center"
        gap={4}
        height={50}
        minWidth={60}
        paddingHorizontal="$1.5"
        borderRadius={8}
        cursor="pointer"
        hoverStyle={{ backgroundColor: ui.navHover }}
        pressStyle={{ scale: 0.96 }}
      >
        {isAuthenticated ? (
          <Avatar circular size="$2.5" src={avatarUrl ?? undefined} name={name} />
        ) : (
          <Icons.CircleUser size={22} color={ui.text} />
        )}
        <Text fontSize={11} fontWeight="400" color={ui.text} numberOfLines={1}>
          {isAuthenticated ? name.split(/\s+/)[0] ?? 'You' : 'Sign in'}
        </Text>
      </YStack>
    </Link>
  )
}