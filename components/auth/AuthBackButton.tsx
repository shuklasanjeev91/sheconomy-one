import { useCallback, useRef } from 'react'
import { useRouter } from 'one'
import type { Href } from 'one'

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
  const router = useRouter()
  const { sanitizeReturnPath, isGuest } = useAccess()
  const navigatingRef = useRef(false)

  const isLight = variant === 'light'
  const color = isLight ? 'white' : ui.text
  const muted = isLight ? 'rgba(255,255,255,0.82)' : ui.textMuted
  const bg = isLight ? 'rgba(255,255,255,0.16)' : ui.surfaceMuted
  const bgHover = isLight ? 'rgba(255,255,255,0.24)' : ui.surfaceHover

  const handleBack = useCallback(() => {
    if (navigatingRef.current) return
    navigatingRef.current = true

    const target = (
      isGuest ? commerceRoutes.home : sanitizeReturnPath(getReturnToFromLocation())
    ) as Href

    router.replace(target)

    setTimeout(() => {
      navigatingRef.current = false
    }, 300)
  }, [isGuest, router, sanitizeReturnPath])

  return (
    <XStack
      alignItems="center"
      gap="$2"
      paddingVertical="$2"
      paddingHorizontal={showLabel ? '$3' : '$2'}
      borderRadius={999}
      backgroundColor={bg}
      cursor="pointer"
      role="button"
      aria-label="Go back"
      hoverStyle={{ backgroundColor: bgHover }}
      pressStyle={{ opacity: 0.85, scale: 0.98 }}
      onPress={handleBack}
    >
      <Icons.ArrowLeft size={20} color={color} />
      {showLabel ? (
        <Text fontSize={14} fontWeight="600" color={muted}>
          Back
        </Text>
      ) : null}
    </XStack>
  )
}
