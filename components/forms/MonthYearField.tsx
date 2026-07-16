import { useEffect, useMemo, useState } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { ScreenSearchField } from '~/components/search'
import { Field, Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import { filterBySearchQuery } from '~/lib/search/filter'
import { useAppUi } from '~/lib/theme/useAppUi'

type MonthYearFieldProps = {
  /** Stored as `YYYY-MM` (month mode) or `YYYY` (yearOnly mode). */
  value: string
  onChange: (value: string) => void
  label: string
  /** Pick a year only (used for education). */
  yearOnly?: boolean
  required?: boolean
  disabled?: boolean
  minYear?: number
  maxYear?: number
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

type Option = { label: string; value: string }

/**
 * Cross-platform month/year picker (works on web, iOS and Android). Renders two
 * tappable dropdowns backed by a bottom sheet, so it looks and behaves the same
 * everywhere without relying on a web-only date-picker package.
 */
export function MonthYearField({
  value,
  onChange,
  label,
  yearOnly = false,
  required = false,
  disabled = false,
  minYear = 1950,
  maxYear = new Date().getFullYear() + 1,
}: MonthYearFieldProps) {
  const [selectedYear, selectedMonth] = useMemo(() => splitValue(value), [value])

  const yearOptions = useMemo<Option[]>(() => {
    const years: Option[] = []
    for (let y = maxYear; y >= minYear; y -= 1) {
      years.push({ label: String(y), value: String(y) })
    }
    return years
  }, [minYear, maxYear])

  const monthOptions = useMemo<Option[]>(
    () => MONTHS.map((name, index) => ({ label: name, value: String(index + 1).padStart(2, '0') })),
    [],
  )

  function commit(nextYear: string, nextMonth: string) {
    if (yearOnly) {
      onChange(nextYear || '')
      return
    }
    if (!nextYear) {
      onChange('')
      return
    }
    onChange(nextMonth ? `${nextYear}-${nextMonth}` : nextYear)
  }

  return (
    <Field label={label} required={required}>
      <XStack gap="$2" width="100%">
        {yearOnly ? null : (
          <DropdownButton
            flex={1}
            placeholder="Month"
            display={selectedMonth ? MONTHS[Number(selectedMonth) - 1] : ''}
            options={monthOptions}
            value={selectedMonth}
            title="Select month"
            disabled={disabled}
            onSelect={(month) => commit(selectedYear, month)}
          />
        )}
        <DropdownButton
          flex={1}
          placeholder="Year"
          display={selectedYear}
          options={yearOptions}
          value={selectedYear}
          title="Select year"
          disabled={disabled}
          onSelect={(year) => commit(year, selectedMonth)}
        />
      </XStack>
    </Field>
  )
}

function splitValue(value: string): [string, string] {
  const raw = value?.trim() ?? ''
  if (!raw) return ['', '']
  const [year, month] = raw.split('-')
  return [year ?? '', month ?? '']
}

function DropdownButton({
  placeholder,
  display,
  options,
  value,
  title,
  onSelect,
  disabled,
  flex,
}: {
  placeholder: string
  display: string
  options: Option[]
  value: string
  title: string
  onSelect: (value: string) => void
  disabled?: boolean
  flex?: number
}) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filteredOptions = useMemo(
    () => filterBySearchQuery(options, query, (option) => [option.label]),
    [options, query],
  )
  const searchable = options.length > 12

  return (
    <>
      <XStack
        flex={flex}
        alignItems="center"
        justifyContent="space-between"
        gap="$2"
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        borderRadius={12}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
        opacity={disabled ? 0.6 : 1}
        cursor={disabled ? 'default' : 'pointer'}
        hoverStyle={disabled ? undefined : { backgroundColor: ui.surfaceMuted }}
        onPress={disabled ? undefined : () => setOpen(true)}
        accessibilityLabel={title}
      >
        <Text flex={1} fontSize={14} color={display ? ui.text : ui.textMuted} numberOfLines={1}>
          {display || placeholder}
        </Text>
        <Icons.ChevronDown size={16} color={ui.textMuted} />
      </XStack>

      <CommunityAdaptiveSheet open={open} onOpenChange={setOpen} title={title} maxWidth={360}>
        {searchable ? (
          <ScreenSearchField
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${placeholder.toLowerCase()}`}
            clearable
          />
        ) : null}
        <ScrollView maxHeight={360} width="100%" keyboardShouldPersistTaps="handled">
          <YStack gap="$1" width="100%">
            {filteredOptions.length === 0 ? (
              <Text color={ui.textMuted} paddingVertical="$3" paddingHorizontal="$3">
                No matches found.
              </Text>
            ) : null}
            {filteredOptions.map((option) => {
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
                    setOpen(false)
                  }}
                >
                  <Text flex={1} fontWeight={selected ? '700' : '600'} color={ui.text}>
                    {option.label}
                  </Text>
                  {selected ? <Icons.Check size={18} color={ui.brand} /> : null}
                </XStack>
              )
            })}
          </YStack>
        </ScrollView>
      </CommunityAdaptiveSheet>
    </>
  )
}
