import { startTransition, useCallback, useRef } from 'react'
import { Platform } from 'react-native'
import { useLocalSearchParams, usePathname, useRouter } from 'one'
import type { Href } from 'one'

import {
  AUTH_RETURN_TO_PARAM,
  normalizeReturnPath,
} from '~/lib/auth/redirect'
import { commerceRoutes } from '~/lib/routes'
import { navigateApp } from '~/lib/platform/navigate'
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
  const pathname = usePathname()
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>()
  const { sanitizeReturnPath } = useAccess()
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

    if (fromParams) {
      // Explicit returnTo in URL — sanitizeReturnPath handles access-tier checks
      // (guests are sent to home when the destination is gated).
      const target = sanitizeReturnPath(normalizeReturnPath(fromParams)) as Href
      navigateApp(target)
      setTimeout(() => { navigatingRef.current = false }, 300)
      return
    }

    // No explicit returnTo — this is an in-place auth gate (URL is the actual
    // route being protected, e.g. /community, /class/…).
    // Use the router's own history check, mirroring useAppBackNavigation.
    let canGoBack = false
    try {
      canGoBack = typeof router.canGoBack === 'function' && router.canGoBack()
    } catch {
      canGoBack = false
    }

    if (!canGoBack) {
      navigatingRef.current = false
      navigateApp(commerceRoutes.home as Href)
      return
    }

    if (Platform.OS === 'web') {
      const fromPath = pathname
      startTransition(() => { router.back() })
      // Web SPAs sometimes report canGoBack but back() silently no-ops.
      // If the path hasn't changed after 120 ms, push home instead.
      window.setTimeout(() => {
        navigatingRef.current = false
        const current = (window.location.pathname.replace(/\/$/, '') || '/') as string
        const expected = (fromPath.replace(/\/$/, '') || '/') as string
        if (current === expected) {
          navigateApp(commerceRoutes.home as Href)
        }
      }, 120)
    } else {
      router.back()
      requestAnimationFrame(() => { navigatingRef.current = false })
    }
  }, [pathname, params, router, sanitizeReturnPath])

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
