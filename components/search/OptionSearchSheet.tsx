import { useEffect, useMemo, useState } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { ScreenSearchField } from '~/components/search/ScreenSearchField'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import { filterBySearchQuery } from '~/lib/search'
import { useAppUi } from '~/lib/theme/useAppUi'

export type OptionSearchItem = {
  value: string
  label: string
  hint?: string
}

type OptionSearchSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  options: OptionSearchItem[]
  value: string
  onSelect: (value: string) => void
  searchPlaceholder?: string
}

/** Searchable bottom sheet for short option lists (sort menus, filters, etc.). */
export function OptionSearchSheet({
  open,
  onOpenChange,
  title,
  options,
  value,
  onSelect,
  searchPlaceholder = 'Search',
}: OptionSearchSheetProps) {
  const ui = useAppUi()
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filtered = useMemo(
    () => filterBySearchQuery(options, query, (option) => [option.label, option.hint]),
    [options, query],
  )

  return (
    <CommunityAdaptiveSheet open={open} onOpenChange={onOpenChange} title={title} maxWidth={420}>
      <ScreenSearchField
        value={query}
        onChangeText={setQuery}
        placeholder={searchPlaceholder}
        clearable
      />
      <YStack gap="$1" width="100%">
        {filtered.length === 0 ? (
          <Text fontSize={14} color={ui.textMuted} paddingVertical="$3">
            No matches found.
          </Text>
        ) : (
          filtered.map((option) => {
            const selected = option.value === value
            return (
              <XStack
                key={option.value}
                paddingHorizontal="$3"
                paddingVertical="$3"
                gap="$3"
                alignItems="center"
                borderRadius={12}
                backgroundColor={selected ? ui.roseTint : 'transparent'}
                cursor="pointer"
                hoverStyle={{ backgroundColor: ui.surfaceHover }}
                pressStyle={{ opacity: 0.9 }}
                onPress={() => {
                  onSelect(option.value)
                  onOpenChange(false)
                }}
              >
                <YStack flex={1} minWidth={0} gap={2}>
                  <Text fontWeight={selected ? '700' : '600'} color={ui.text} numberOfLines={1}>
                    {option.label}
                  </Text>
                  {option.hint ? (
                    <Text fontSize={12} color={ui.textMuted} numberOfLines={1}>
                      {option.hint}
                    </Text>
                  ) : null}
                </YStack>
                {selected ? <Icons.Check size={18} color={ui.brand} /> : null}
              </XStack>
            )
          })
        )}
      </YStack>
    </CommunityAdaptiveSheet>
  )
}
