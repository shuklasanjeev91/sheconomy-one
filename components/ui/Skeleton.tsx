import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'
import { XStack, YStack } from 'tamagui'

import { useAppUi } from '~/lib/theme/useAppUi'

type SkeletonProps = {
  width?: number | string
  height?: number | string
  borderRadius?: number
}

/** Lightweight placeholder block that respects reduced-motion preferences. */
export function Skeleton({ width = '100%', height = 16, borderRadius = 8 }: SkeletonProps) {
  const ui = useAppUi()
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled?.().then((value) => {
      if (mounted) setReduceMotion(!!value)
    })
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (value: boolean) => {
        setReduceMotion(!!value)
      },
    )
    return () => {
      mounted = false
      // @ts-expect-error RN subscription shape varies by version
      sub?.remove?.()
    }
  }, [])

  return (
    <YStack
      width={width as any}
      height={height as any}
      borderRadius={borderRadius}
      backgroundColor={ui.roseSurface ?? ui.surfaceMuted}
      opacity={reduceMotion ? 1 : 0.85}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={
        Platform.OS === 'web' && !reduceMotion
          ? ({
              animation: 'skeletonPulse 1.2s ease-in-out infinite',
            } as any)
          : undefined
      }
    />
  )
}

export function CardSkeleton() {
  return (
    <YStack gap="$3" padding="$3" borderRadius="$5">
      <Skeleton height={140} borderRadius={12} />
      <Skeleton height={14} width="70%" />
      <Skeleton height={12} width="40%" />
    </YStack>
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <YStack gap="$3" padding="$3">
      {Array.from({ length: rows }).map((_, index) => (
        <XStack key={index} gap="$3" alignItems="center">
          <Skeleton width={48} height={48} borderRadius={24} />
          <YStack flex={1} gap="$2">
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="40%" />
          </YStack>
        </XStack>
      ))}
    </YStack>
  )
}
