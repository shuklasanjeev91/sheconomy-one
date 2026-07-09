import { Link } from 'one'

import { getReturnToFromLocation } from '~/lib/auth/redirect'
import { commerceRoutes } from '~/lib/routes'
import { useAccess } from '~/hooks/useAccess'
import { Icons, Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type AuthBackButtonProps = {
  /** `light` sits on the brand gradient; `dark` on neutral surfaces. */
  variant?: 'light' | 'dark'
  showLabel?: boolean
}

export function AuthBackButton({ variant = 'dark', showLabel = true }: AuthBackButtonProps) {
  const ui = useAppUi()
  const { sanitizeReturnPath, isGuest } = useAccess()
  const href = (isGuest ? commerceRoutes.home : sanitizeReturnPath(getReturnToFromLocation())) as import('one').Href
  const isLight = variant === 'light'
  const color = isLight ? 'white' : ui.text
  const muted = isLight ? 'rgba(255,255,255,0.82)' : ui.textMuted
  const bg = isLight ? 'rgba(255,255,255,0.16)' : ui.surfaceMuted
  const bgHover = isLight ? 'rgba(255,255,255,0.24)' : ui.surfaceHover

  return (
    <Link href={href} asChild>
      <XStack
        alignItems="center"
        gap="$2"
        paddingVertical="$2"
        paddingHorizontal={showLabel ? '$3' : '$2'}
        borderRadius={999}
        backgroundColor={bg}
        cursor="pointer"
        hoverStyle={{ backgroundColor: bgHover }}
        pressStyle={{ opacity: 0.85, scale: 0.98 }}
        aria-label="Go back"
      >
        <Icons.ArrowLeft size={20} color={color} />
        {showLabel ? (
          <Text fontSize={14} fontWeight="600" color={muted}>
            Back
          </Text>
        ) : null}
      </XStack>
    </Link>
  )
}