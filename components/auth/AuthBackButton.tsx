import { useCallback, useRef } from 'react'
import type { Href } from 'one'
import { useLocalSearchParams } from 'one'

import {
  AUTH_RETURN_TO_PARAM,
  isSafeReturnPath,
  normalizeReturnPath,
} from '~/lib/auth/redirect'
import { getDefaultHomeForTier } from '~/lib/auth/access'
import { navigateApp } from '~/lib/platform/navigate'
import { useAccess } from '~/hooks/useAccess'
import { Icons, Text, XStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type AuthBackButtonProps = {
  /** `light` sits on the brand gradient; `dark` on neutral surfaces. */
  variant?: 'light' | 'dark'
  showLabel?: boolean
  /**
   * Preferred post-dismiss path from the auth gate (e.g. the route that
   * triggered sign-in). Only used when the current tier can access it —
   * otherwise we exit to the default home (avoids bouncing back into the gate).
   */
  returnTo?: string | null
}

/**
 * Leave the auth gate. Do not use `router.back()` — on native, auth is often an
 * in-place overlay with no stack entry, so back() no-ops and the button looks broken.
 */
export function AuthBackButton({
  variant = 'dark',
  showLabel = true,
  returnTo: returnToProp,
}: AuthBackButtonProps) {
  const ui = useAppUi()
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>()
  const { tier, isVerified, canAccessPath } = useAccess()
  const navigatingRef = useRef(false)

  const isLight = variant === 'light'
  const color = isLight ? 'white' : ui.text
  const muted = isLight ? 'rgba(255,255,255,0.82)' : ui.textMuted
  const bg = isLight ? 'rgba(255,255,255,0.16)' : ui.surfaceMuted
  const bgHover = isLight ? 'rgba(255,255,255,0.24)' : ui.surfaceHover

  const handleBack = useCallback(() => {
    if (navigatingRef.current) return
    navigatingRef.current = true

    const raw = params[AUTH_RETURN_TO_PARAM]
    const fromParams = Array.isArray(raw) ? raw[0] : raw
    const candidate = normalizeReturnPath(returnToProp ?? fromParams ?? null, '')

    let target: Href
    if (isSafeReturnPath(candidate) && canAccessPath(candidate)) {
      target = candidate as Href
    } else {
      target = getDefaultHomeForTier(tier, isVerified)
    }

    navigateApp(target)
    setTimeout(() => {
      navigatingRef.current = false
    }, 400)
  }, [params, returnToProp, canAccessPath, tier, isVerified])

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
      hitSlop={12}
      zIndex={20}
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
