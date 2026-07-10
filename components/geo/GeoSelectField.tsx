import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

import { GeoSearchSheet } from '~/components/geo/GeoSearchSheet'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import type { GeoOption } from '~/lib/geo'
import { useAppUi } from '~/lib/theme/useAppUi'

type GeoSelectFieldProps = {
  label: string
  value: string
  displayValue?: string
  placeholder: string
  options: GeoOption[]
  onChange: (value: string, option: GeoOption) => void
  disabled?: boolean
  sheetTitle?: string
  searchPlaceholder?: string
  showFlags?: boolean
  required?: boolean
  flex?: number
  minWidth?: number
}

export function GeoSelectField({
  label,
  value,
  displayValue,
  placeholder,
  options,
  onChange,
  disabled = false,
  sheetTitle,
  searchPlaceholder,
  showFlags = false,
  required = false,
  flex,
  minWidth,
}: GeoSelectFieldProps) {
  const ui = useAppUi()
  const [open, setOpen] = useState(false)

  const resolvedLabel = useMemo(() => {
    if (displayValue?.trim()) return displayValue
    if (!value.trim()) return ''
    return options.find((option) => option.value === value)?.label ?? value
  }, [displayValue, options, value])

  return (
    <>
      <YStackField label={label} required={required} flex={flex} minWidth={minWidth}>
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
        >
          <Text
            flex={1}
            fontSize={14}
            color={resolvedLabel ? ui.text : ui.textMuted}
            numberOfLines={1}
          >
            {resolvedLabel || placeholder}
          </Text>
          {!disabled ? <Icons.ChevronDown size={16} color={ui.textMuted} /> : null}
        </XStack>
      </YStackField>

      <GeoSearchSheet
        open={open}
        onOpenChange={setOpen}
        title={sheetTitle ?? label}
        options={options}
        value={value}
        onSelect={(option) => onChange(option.value, option)}
        searchPlaceholder={searchPlaceholder}
        showFlags={showFlags}
      />
    </>
  )
}

function YStackField({
  label,
  required,
  children,
  flex,
  minWidth,
}: {
  label: string
  required?: boolean
  children: ReactNode
  flex?: number
  minWidth?: number
}) {
  const ui = useAppUi()
  return (
    <YStack gap="$1.5" flex={flex} minWidth={minWidth} width={flex ? undefined : '100%'}>
      <Text fontSize={13} fontWeight="600" color={ui.textSecondary}>
        {label}
        {required ? ' *' : ''}
      </Text>
      {children}
    </YStack>
  )
}
