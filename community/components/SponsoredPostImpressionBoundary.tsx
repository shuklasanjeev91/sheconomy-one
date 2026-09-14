import { useEffect, useRef, type ReactNode } from 'react'
import { Platform, View } from 'react-native'

import {
  recordSponsoredImpressionOnce,
  type SponsoredFeedItem,
} from '~/community/lib/sponsored-ads'

export function SponsoredPostImpressionBoundary({
  item,
  children,
}: {
  item: SponsoredFeedItem
  children: ReactNode
}) {
  const ref = useRef<View>(null)

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined') return
    const node = ref.current as unknown as Element | null
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
          recordSponsoredImpressionOnce(item)
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [item])

  return <View ref={ref}>{children}</View>
}
