import { useState } from 'react'

import { Button, Icons, Popover, PopoverContent, Text, XStack, YStack } from '~/components/ui'
import type { ListingSort } from '~/commerce/lib/filters'
import { useAppUi } from '~/lib/theme/useAppUi'

type SortOption = { value: ListingSort; label: string }

type ListingSortMenuProps = {
  value: ListingSort
  options: SortOption[]
  onChange: (sort: ListingSort) => void
}

/** Compact sort control — outline pill, opens a popover menu. */
export function ListingSortMenu({ value, options, onChange }: ListingSortMenuProps) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)
  const label = options.find((option) => option.value === value)?.label ?? 'Relevance'

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end">
      <Popover.Trigger asChild>
        <Button
          tone="outline"
          size="$3"
          borderRadius={999}
          backgroundColor={ui.surface}
          borderColor={ui.text}
          flexShrink={0}
          aria-label={`Sort by ${label}`}
        >
          <XStack gap="$2" alignItems="center">
            <Text fontSize={14} fontWeight="500" color={ui.text}>
              {label}
            </Text>
            <Icons.ChevronDown size={16} color={ui.text} />
          </XStack>
        </Button>
      </Popover.Trigger>
      <PopoverContent padding="$2" minWidth={220} zIndex={300_000}>
        <YStack gap="$1" width="100%">
          {options.map((option) => {
            const selected = option.value === value
            return (
              <XStack
                key={option.value}
                width="100%"
                paddingHorizontal="$3"
                paddingVertical="$2.5"
                borderRadius="$4"
                cursor="pointer"
                alignItems="center"
                backgroundColor={selected ? ui.chip : 'transparent'}
                hoverStyle={{ backgroundColor: ui.chipHover }}
                onPress={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <Text
                  fontSize={14}
                  fontWeight={selected ? '600' : '500'}
                  color={selected ? ui.text : ui.textSecondary}
                >
                  {option.label}
                </Text>
              </XStack>
            )
          })}
        </YStack>
      </PopoverContent>
    </Popover>
  )
}
