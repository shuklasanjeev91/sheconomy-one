import { useEffect, useMemo, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform } from 'react-native'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { Field, Icons, Input, ScrollView, Spinner, Text, XStack, YStack } from '~/components/ui'
import { SHEET_SEARCH_MIN_ITEMS } from '~/lib/search'
import { useAppUi } from '~/lib/theme/useAppUi'

export type SearchSelectFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  /** Static option list. Ignored when `loadOptions` is provided. */
  options?: string[]
  /** Async option loader (e.g. remote autocomplete). Debounced internally. */
  loadOptions?: (query: string) => Promise<string[]>
  placeholder?: string
  searchPlaceholder?: string
  sheetTitle?: string
  /** Allow keeping a free-text value that isn't in the option list. */
  allowCustom?: boolean
  required?: boolean
  disabled?: boolean
}

/**
 * Cross-platform searchable select (works on web, iOS and Android via a bottom
 * sheet). Supports static option lists, async autocomplete and free-text entry
 * — the building block for the Industry / Occupation / Company pickers.
 */
export function SearchSelectField({
  label,
  value,
  onChange,
  options,
  loadOptions,
  placeholder = 'Select',
  searchPlaceholder = 'Search…',
  sheetTitle,
  allowCustom = false,
  required = false,
  disabled = false,
}: SearchSelectFieldProps) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Field label={label} required={required}>
        <XStack
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
          accessibilityLabel={label}
        >
          <Text flex={1} fontSize={14} color={value ? ui.text : ui.textMuted} numberOfLines={1}>
            {value || placeholder}
          </Text>
          {!disabled ? <Icons.ChevronDown size={16} color={ui.textMuted} /> : null}
        </XStack>
      </Field>

      <SearchSelectSheet
        open={open}
        onOpenChange={setOpen}
        title={sheetTitle ?? label}
        value={value}
        options={options}
        loadOptions={loadOptions}
        searchPlaceholder={searchPlaceholder}
        allowCustom={allowCustom}
        onSelect={(next) => {
          onChange(next)
          setOpen(false)
        }}
      />
    </>
  )
}

type SearchSelectSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  value: string
  options?: string[]
  loadOptions?: (query: string) => Promise<string[]>
  searchPlaceholder: string
  allowCustom: boolean
  onSelect: (value: string) => void
}

function SearchSelectSheet({
  open,
  onOpenChange,
  title,
  value,
  options,
  loadOptions,
  searchPlaceholder,
  allowCustom,
  onSelect,
}: SearchSelectSheetProps) {
  const ui = useAppUi()
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    if (!loadOptions || !open) return
    const id = ++requestId.current
    setLoading(true)
    const handle = setTimeout(() => {
      loadOptions(query.trim())
        .then((results) => {
          if (id === requestId.current) setRemote(results)
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false)
        })
    }, 220)
    return () => clearTimeout(handle)
  }, [query, loadOptions, open])

  const filtered = useMemo(() => {
    if (loadOptions) return remote
    const normalized = query.trim().toLowerCase()
    const list = options ?? []
    if (!normalized) return list.slice(0, 100)
    return list.filter((item) => item.toLowerCase().includes(normalized)).slice(0, 100)
  }, [options, loadOptions, remote, query])

  const trimmedQuery = query.trim()
  const showCustom =
    allowCustom &&
    trimmedQuery.length > 0 &&
    !filtered.some((item) => item.toLowerCase() === trimmedQuery.toLowerCase())

  // Async pickers and free-text entry need the search box; short static
  // option lists don't.
  const showSearch =
    Boolean(loadOptions) ||
    allowCustom ||
    (options?.length ?? 0) >= SHEET_SEARCH_MIN_ITEMS ||
    query.length > 0

  const listMaxHeight = Platform.OS === 'web' ? 420 : 360
  const body = (
    <YStack gap="$3" width="100%">
      {showSearch ? (
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          paddingVertical="$2"
          borderRadius={12}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
        >
          <Icons.Search size={18} color={ui.textMuted} />
          <Input
            flex={1}
            borderWidth={0}
            backgroundColor="transparent"
            placeholder={searchPlaceholder}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {loading ? <Spinner size="small" /> : null}
        </XStack>
      ) : null}

      <ScrollView maxHeight={listMaxHeight} width="100%" keyboardShouldPersistTaps="handled">
        <YStack gap="$1" width="100%">
          {showCustom ? (
            <SelectRow
              label={`Use “${trimmedQuery}”`}
              selected={false}
              icon={<Icons.Plus size={18} color={ui.brand} />}
              onPress={() => onSelect(trimmedQuery)}
            />
          ) : null}

          {filtered.length === 0 && !showCustom ? (
            <Text fontSize={14} color={ui.textMuted} padding="$3">
              {loading ? 'Searching…' : 'No matches found.'}
            </Text>
          ) : (
            filtered.map((item) => (
              <SelectRow
                key={item}
                label={item}
                selected={item === value}
                icon={item === value ? <Icons.Check size={18} color={ui.brand} /> : null}
                onPress={() => onSelect(item)}
              />
            ))
          )}
        </YStack>
      </ScrollView>
    </YStack>
  )

  return (
    <CommunityAdaptiveSheet open={open} onOpenChange={onOpenChange} title={title} maxWidth={480}>
      {Platform.OS === 'web' ? (
        body
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {body}
        </KeyboardAvoidingView>
      )}
    </CommunityAdaptiveSheet>
  )
}

function SelectRow({
  label,
  selected,
  icon,
  onPress,
}: {
  label: string
  selected: boolean
  icon: React.ReactNode
  onPress: () => void
}) {
  const ui = useAppUi()
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$3"
      gap="$3"
      alignItems="center"
      borderRadius={12}
      backgroundColor={selected ? ui.roseTint : 'transparent'}
      cursor="pointer"
      hoverStyle={{ backgroundColor: ui.surfaceHover }}
      pressStyle={{ opacity: 0.9 }}
      onPress={onPress}
    >
      <Text flex={1} fontWeight={selected ? '700' : '600'} color={ui.text} numberOfLines={1}>
        {label}
      </Text>
      {icon}
    </XStack>
  )
}
