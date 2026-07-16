import { useEffect, useMemo, useState } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { useCommunityUi } from '~/community/lib/community-theme'
import { ScreenSearchField } from '~/components/search'
import { Button, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { filterBySearchQuery } from '~/lib/search'
import { radius } from '~/config/tokens'

export type FilterOption = {
  label: string
  value: string
  hint?: string
}

type CommunityFilterPillProps = {
  label: string
  /** Human-readable summary of the active selection, e.g. "Full-time". */
  summary?: string
  active?: boolean
  onPress: () => void
}

/** professional filter chip that opens a dropdown (desktop) / bottom sheet (mobile). */
export function CommunityFilterPill({ label, summary, active, onPress }: CommunityFilterPillProps) {
  const communityUi = useCommunityUi()
  const isActive = Boolean(active)

  return (
    <XStack
      alignItems="center"
      gap={6}
      paddingLeft={14}
      paddingRight={10}
      paddingVertical={8}
      borderRadius={999}
      borderWidth={1}
      borderColor={isActive ? communityUi.brand : communityUi.border}
      backgroundColor={isActive ? communityUi.accentMuted : communityUi.cardBg}
      cursor="pointer"
      hoverStyle={{ backgroundColor: isActive ? communityUi.accentMuted : communityUi.hoverBg }}
      pressStyle={{ opacity: 0.8 }}
      animation="quick"
      onPress={onPress}
    >
      <Text
        fontSize={13}
        fontWeight={isActive ? '700' : '600'}
        color={isActive ? communityUi.brand : communityUi.text}
        numberOfLines={1}
      >
        {isActive && summary ? summary : label}
      </Text>
      <Icons.ChevronDown size={15} color={isActive ? communityUi.brand : communityUi.textMuted} />
    </XStack>
  )
}

type OptionRowProps = {
  option: FilterOption
  selected: boolean
  multi: boolean
  onToggle: () => void
}

function OptionRow({ option, selected, multi, onToggle }: OptionRowProps) {
  const communityUi = useCommunityUi()

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      gap={12}
      paddingVertical={12}
      paddingHorizontal={6}
      borderRadius={radius.chip}
      cursor="pointer"
      hoverStyle={{ backgroundColor: communityUi.hoverBg }}
      pressStyle={{ opacity: 0.75 }}
      onPress={onToggle}
    >
      <YStack flex={1} gap={2}>
        <Text fontSize={15} fontWeight={selected ? '700' : '500'} color={communityUi.text}>
          {option.label}
        </Text>
        {option.hint ? (
          <Text fontSize={12} color={communityUi.textMuted}>
            {option.hint}
          </Text>
        ) : null}
      </YStack>

      {multi ? (
        <XStack
          width={22}
          height={22}
          borderRadius={6}
          borderWidth={2}
          borderColor={selected ? communityUi.brand : communityUi.border}
          backgroundColor={selected ? communityUi.brand : 'transparent'}
          alignItems="center"
          justifyContent="center"
        >
          {selected ? <Icons.Check size={14} color="white" /> : null}
        </XStack>
      ) : selected ? (
        <Icons.Check size={20} color={communityUi.brand} />
      ) : null}
    </XStack>
  )
}

type CommunityFilterSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  options: FilterOption[]
  /** Current committed selection (array of option values). */
  value: string[]
  onApply: (next: string[]) => void
  /** Allow selecting multiple values. Defaults to single-select. */
  multi?: boolean
  /** Show a search box to filter long option lists (e.g. companies). */
  searchable?: boolean
  searchPlaceholder?: string
}

/**
 * Adaptive filter picker used by every community filter pill.
 * Keeps a local draft so nothing is applied until "Show results" is pressed.
 */
export function CommunityFilterSheet({
  open,
  onOpenChange,
  title,
  options,
  value,
  onApply,
  multi = false,
  searchable = true,
  searchPlaceholder = 'Search',
}: CommunityFilterSheetProps) {
  const communityUi = useCommunityUi()
  const [draft, setDraft] = useState<string[]>(value)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) {
      setDraft(value)
      setQuery('')
    }
  }, [open, value])

  const visibleOptions = useMemo(() => {
    if (!searchable) return options
    return filterBySearchQuery(options, query, (option) => [option.label, option.hint])
  }, [options, query, searchable])

  function toggle(optionValue: string) {
    if (multi) {
      setDraft((current) =>
        current.includes(optionValue)
          ? current.filter((v) => v !== optionValue)
          : [...current, optionValue],
      )
      return
    }
    setDraft([optionValue])
    onApply([optionValue])
    onOpenChange(false)
  }

  function apply() {
    onApply(draft)
    onOpenChange(false)
  }

  function reset() {
    setDraft([])
    onApply([])
    onOpenChange(false)
  }

  return (
    <CommunityAdaptiveSheet open={open} onOpenChange={onOpenChange} title={title}>
      {searchable ? (
        <ScreenSearchField
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          clearable
        />
      ) : null}

      <YStack gap={2}>
        {visibleOptions.length === 0 ? (
          <Text color={communityUi.textMuted} paddingVertical={12}>
            No matches.
          </Text>
        ) : (
          visibleOptions.map((option) => (
            <OptionRow
              key={option.value}
              option={option}
              selected={draft.includes(option.value)}
              multi={multi}
              onToggle={() => toggle(option.value)}
            />
          ))
        )}
      </YStack>

      {multi ? (
        <XStack gap={10} paddingTop={8}>
          <Button flex={1} chromeless onPress={reset}>
            Reset
          </Button>
          <Button
            flex={2}
            backgroundColor={communityUi.brand}
            color="white"
            borderRadius={999}
            onPress={apply}
          >
            Show results
          </Button>
        </XStack>
      ) : null}
    </CommunityAdaptiveSheet>
  )
}
