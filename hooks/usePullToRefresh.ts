import { createElement, useCallback, useRef, useState } from 'react'
import { Platform, RefreshControl } from 'react-native'

import { useAppUi } from '~/lib/theme/useAppUi'

type UsePullToRefreshOptions = {
  onRefresh?: () => void | Promise<void>
  /** When provided, controls the spinner externally. */
  refreshing?: boolean
}

/**
 * Cross-platform pull-to-refresh helpers for PageScroll / ScrollView.
 * Native: RefreshControl. Web (touch scroll): lightweight overscroll pull.
 */
export function usePullToRefresh({ onRefresh, refreshing: refreshingProp }: UsePullToRefreshOptions) {
  const ui = useAppUi()
  const [internalRefreshing, setInternalRefreshing] = useState(false)
  const refreshing = refreshingProp ?? internalRefreshing
  const pullStartY = useRef<number | null>(null)
  const pulling = useRef(false)

  const runRefresh = useCallback(async () => {
    if (!onRefresh || refreshing) return
    if (refreshingProp === undefined) setInternalRefreshing(true)
    try {
      await onRefresh()
    } finally {
      if (refreshingProp === undefined) setInternalRefreshing(false)
    }
  }, [onRefresh, refreshing, refreshingProp])

  const refreshControl =
    onRefresh && Platform.OS !== 'web'
      ? createElement(RefreshControl, {
          refreshing,
          onRefresh: () => {
            void runRefresh()
          },
          tintColor: ui.brand,
          colors: [ui.brand],
        })
      : undefined

  /** Web touch pull-to-refresh on a scrollable element (not desktop document scroll). */
  const webPullHandlers =
    onRefresh && Platform.OS === 'web'
      ? {
          onTouchStart: (event: { touches?: Array<{ clientY: number }> }) => {
            const y = event.touches?.[0]?.clientY
            if (typeof y === 'number') {
              pullStartY.current = y
              pulling.current = false
            }
          },
          onTouchMove: (event: {
            touches?: Array<{ clientY: number }>
            currentTarget?: { scrollTop?: number }
          }) => {
            const start = pullStartY.current
            const y = event.touches?.[0]?.clientY
            const scrollTop = event.currentTarget?.scrollTop ?? 0
            if (start == null || typeof y !== 'number') return
            if (scrollTop <= 0 && y - start > 72) {
              pulling.current = true
            }
          },
          onTouchEnd: () => {
            if (pulling.current) {
              void runRefresh()
            }
            pullStartY.current = null
            pulling.current = false
          },
        }
      : undefined

  return {
    refreshing,
    refreshControl,
    webPullHandlers,
    runRefresh,
  }
}
