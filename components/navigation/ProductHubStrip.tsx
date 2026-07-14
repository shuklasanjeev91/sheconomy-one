import { useRouter } from 'one'
import type { Href } from 'one'
import type { ComponentType } from 'react'

import { HorizontalScrollRow } from '~/components/layout'
import { Text, XStack, YStack } from '~/components/ui'
import { radius } from '~/config/tokens'
import { useAppUi } from '~/lib/theme/useAppUi'

export type ProductHubItem = {
  id: string
  label: string
  description?: string
  icon: ComponentType<{ size?: number; color?: string }>
  href?: Href
  onPress?: () => void
  badge?: string | number | null
}

type ProductHubStripProps = {
  title?: string
  items: ProductHubItem[]
}

/**
 * Cross-platform shortcut strip (web + iOS + Android).
 * Pure navigation / actions — no web-only APIs.
 */
export function ProductHubStrip({ title = 'Shortcuts', items }: ProductHubStripProps) {
  const ui = useAppUi()
  const router = useRouter()

  if (items.length === 0) return null

  function activate(item: ProductHubItem) {
    if (item.onPress) {
      item.onPress()
      return
    }
    if (item.href) router.push(item.href as never)
  }

  return (
    <YStack gap="$2" width="100%">
      <Text fontSize={14} fontWeight="700" color={ui.text}>
        {title}
      </Text>
      <HorizontalScrollRow gap="$2">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <YStack
              key={item.id}
              minWidth={112}
              maxWidth={140}
              paddingHorizontal="$3"
              paddingVertical="$3"
              gap="$1.5"
              borderRadius={radius.card}
              borderWidth={1}
              borderColor={ui.borderSubtle}
              backgroundColor={ui.surface}
              cursor="pointer"
              hoverStyle={{ backgroundColor: ui.surfaceHover, borderColor: ui.brand }}
              pressStyle={{ opacity: 0.9, scale: 0.98 }}
              onPress={() => activate(item)}
            >
              <XStack alignItems="center" justifyContent="space-between" gap="$2">
                <YStack
                  width={32}
                  height={32}
                  borderRadius={10}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={ui.surfaceMuted}
                >
                  <Icon size={16} color={ui.brand} />
                </YStack>
                {item.badge != null && String(item.badge).length > 0 ? (
                  <XStack
                    minWidth={20}
                    paddingHorizontal={6}
                    height={20}
                    borderRadius={999}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor={ui.brand}
                  >
                    <Text fontSize={10} fontWeight="700" color={ui.onBrand}>
                      {item.badge}
                    </Text>
                  </XStack>
                ) : null}
              </XStack>
              <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                {item.label}
              </Text>
              {item.description ? (
                <Text fontSize={11} color={ui.textMuted} numberOfLines={2} lineHeight={14}>
                  {item.description}
                </Text>
              ) : null}
            </YStack>
          )
        })}
      </HorizontalScrollRow>
    </YStack>
  )
}
