import { usePathname } from 'one'
import { useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import { SpeedInsights as VercelSpeedInsights } from '@vercel/speed-insights/react'

import { ExternalAnalyticsNoscript } from '~/components/analytics/ExternalAnalyticsScripts'
import { trackExternalPageView } from '~/lib/analytics'
import { EXTERNAL_ANALYTICS_ENABLED } from '~/lib/analytics/config'

/**
 * Tracks SPA route changes across GTM / GA4 / Meta Pixel / Clarity and mounts
 * Vercel Analytics + Speed Insights on web. On native, Clarity handles screens.
 */
export function ExternalAnalyticsTracker() {
  const pathname = usePathname()
  const lastPathRef = useRef<string | null>(null)

  useEffect(() => {
    if (!EXTERNAL_ANALYTICS_ENABLED) return
    if (!pathname || lastPathRef.current === pathname) return
    lastPathRef.current = pathname
    trackExternalPageView(pathname)
  }, [pathname])

  if (Platform.OS !== 'web' || !EXTERNAL_ANALYTICS_ENABLED) return null

  return (
    <>
      <ExternalAnalyticsNoscript />
      <VercelAnalytics />
      <VercelSpeedInsights />
    </>
  )
}
