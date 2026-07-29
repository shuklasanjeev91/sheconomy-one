import { useEffect } from 'react'
import { Platform } from 'react-native'

import { useStableMedia } from '~/hooks/useStableMedia'

import { useAppBarScroll } from '~/components/navigation/AppBarScrollContext'

/** Reports window scroll position for desktop sticky header collapse. */
export function DesktopScrollTracker() {
  const media = useStableMedia()
  const { setScrollY } = useAppBarScroll()

  useEffect(() => {
    if (Platform.OS !== 'web' || !media.desktopWeb) {
      setScrollY(0)
      return
    }

    const onScroll = () => setScrollY(window.scrollY)

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      setScrollY(0)
    }
  }, [media.desktopWeb, setScrollY])

  return null
}