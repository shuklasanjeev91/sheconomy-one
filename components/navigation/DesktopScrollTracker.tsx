import { useEffect } from 'react'
import { Platform } from 'react-native'

import { useMedia } from '~/components/ui'

import { useAppBarScroll } from './AppBarScrollContext'

/** Reports window scroll position for desktop sticky header collapse. */
export function DesktopScrollTracker() {
  const media = useMedia()
  const { setScrollY } = useAppBarScroll()

  useEffect(() => {
    if (Platform.OS !== 'web' || !media.gtMd) {
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
  }, [media.gtMd, setScrollY])

  return null
}