import { useState } from 'react'

import { OptionSearchSheet } from '~/components/search/OptionSearchSheet'
import { Button, Icons, Text, XStack } from '~/components/ui'
import type { ListingSort } from '~/commerce/lib/filters'
import { useAppUi } from '~/lib/theme/useAppUi'

type SortOption = { value: ListingSort; label: string }

type ListingSortMenuProps = {
  value: ListingSort
  options: SortOption[]
  onChange: (sort: ListingSort) => void
}

/** Compact sort control — opens a searchable bottom sheet. */
export function ListingSortMenu({ value, options, onChange }: ListingSortMenuProps) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)
  const label = options.find((option) => option.value === value)?.label ?? 'Relevance'

  return (
    <>
      <Button
        tone="outline"
        size="$3"
        borderRadius={999}
        backgroundColor={ui.surface}
        borderColor={ui.text}
        flexShrink={0}
        aria-label={`Sort by ${label}`}
        onPress={() => setOpen(true)}
      >
        <XStack gap="$2" alignItems="center">
          <Text fontSize={14} fontWeight="500" color={ui.text}>
            {label}
          </Text>
          <Icons.ChevronDown size={16} color={ui.text} />
        </XStack>
      </Button>

      <OptionSearchSheet
        open={open}
        onOpenChange={setOpen}
        title="Sort by"
        options={options}
        value={value}
        onSelect={(next) => onChange(next as ListingSort)}
        searchPlaceholder="Search sort options"
      />
    </>
  )
}
