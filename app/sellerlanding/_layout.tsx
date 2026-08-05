import { useEffect } from 'react'
import { Slot } from 'one'

import { captureUtmFromUrl } from '~/lib/utm/utm.utils'

/**
 * Layout for the seller landing page.
 * Captures UTM params before the page mounts so the application form
 * can read them. The original app header is kept; only the footer
 * (commerce desktop footer + mobile bottom tabs) is suppressed in AppShell.
 */
export default function SellerLandingLayout() {
  useEffect(() => {
    captureUtmFromUrl()
  }, [])

  return <Slot />
}
