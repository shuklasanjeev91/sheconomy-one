import { useEffect, useMemo, useState } from 'react'

import {
  AppBottomSheet,
  Button,
  Input,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { getAllGeoCountries, getCountryName } from '~/lib/geo/data'
import {
  PRIORITY_COUNTRY_CODES,
  REGION_LANGUAGES,
  allRegionCurrencies,
  defaultCurrencyForCountry,
} from '~/lib/locale/region-data'
import { useRegionPreferences } from '~/lib/locale/RegionPreferencesContext'
import { useAppUi } from '~/lib/theme/useAppUi'

type RegionPreferencesSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type OptionRowProps = {
  label: string
  selected: boolean
  onPress: () => void
  meta?: string
}

function OptionRow({ label, selected, onPress, meta }: OptionRowProps) {
  const ui = useAppUi()
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$2.5"
      borderRadius={10}
      alignItems="center"
      justifyContent="space-between"
      backgroundColor={selected ? ui.surfaceMuted : 'transparent'}
      borderWidth={1}
      borderColor={selected ? ui.brand : 'transparent'}
      pressStyle={{ opacity: 0.9 }}
      cursor="pointer"
      onPress={onPress}
    >
      <Text fontSize={14} fontWeight={selected ? '700' : '500'} color={ui.text} flex={1}>
        {label}
      </Text>
      {meta ? (
        <Text fontSize={12} color={ui.textMuted} marginLeft="$2">
          {meta}
        </Text>
      ) : null}
    </XStack>
  )
}

/**
 * Country / language / currency picker.
 * Changing country updates the suggested currency (buyer can still override).
 */
export function RegionPreferencesSheet({ open, onOpenChange }: RegionPreferencesSheetProps) {
  const ui = useAppUi()
  const toast = useAppToast()
  const prefs = useRegionPreferences()
  const [countryCode, setCountryCode] = useState(prefs.countryCode)
  const [languageCode, setLanguageCode] = useState(prefs.languageCode)
  const [currencyCode, setCurrencyCode] = useState(prefs.currencyCode)
  const [countryQuery, setCountryQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [section, setSection] = useState<'country' | 'language' | 'currency'>('country')

  useEffect(() => {
    if (!open) return
    setCountryCode(prefs.countryCode)
    setLanguageCode(prefs.languageCode)
    setCurrencyCode(prefs.currencyCode)
    setCountryQuery('')
    setSection('country')
  }, [open, prefs.countryCode, prefs.languageCode, prefs.currencyCode])

  const countries = useMemo(() => {
    const all = getAllGeoCountries()
    const priority = new Set<string>(PRIORITY_COUNTRY_CODES as unknown as string[])
    const q = countryQuery.trim().toLowerCase()
    let list = all
    if (q) {
      list = all.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.isoCode.toLowerCase().includes(q) ||
          c.phonecode.includes(q),
      )
    } else {
      const prioritized = PRIORITY_COUNTRY_CODES.map((code) =>
        all.find((c) => c.isoCode === code),
      ).filter(Boolean) as typeof all
      const rest = all.filter((c) => !priority.has(c.isoCode))
      list = [...prioritized, ...rest]
    }
    return list.slice(0, q ? 80 : 60)
  }, [countryQuery])

  const currencies = useMemo(() => allRegionCurrencies(), [])

  function handleSelectCountry(code: string) {
    setCountryCode(code)
    setCurrencyCode(defaultCurrencyForCountry(code))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await prefs.setPreferences({ countryCode, languageCode, currencyCode })
      toast.show('Region updated', {
        tone: 'success',
        message: `${getCountryName(countryCode)} · ${currencyCode}`,
      })
      onOpenChange(false)
    } catch (error) {
      toast.show('Could not save', {
        tone: 'danger',
        message: error instanceof Error ? error.message : 'Try again.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleUseDevice() {
    setSaving(true)
    try {
      await prefs.resetToDevice()
      toast.show('Using device settings', { tone: 'success' })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Update your settings"
      footer={
        <XStack gap="$2" width="100%">
          <Button flex={1} tone="outline" borderRadius={999} disabled={saving} onPress={handleUseDevice}>
            Use device
          </Button>
          <Button
            flex={2}
            tone="primary"
            borderRadius={999}
            disabled={saving}
            onPress={() => void handleSave()}
            icon={saving ? <Spinner size="small" color="white" /> : undefined}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </XStack>
      }
    >
      <Text fontSize={13} color={ui.textMuted} lineHeight={19}>
        Choose where you shop, your language, and the currency you prefer. Prices across the app
        convert into your currency using live exchange rates.
      </Text>

      <XStack gap="$2" flexWrap="wrap">
        {(
          [
            { id: 'country' as const, label: 'Country' },
            { id: 'language' as const, label: 'Language' },
            { id: 'currency' as const, label: 'Currency' },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.id}
            size="$2"
            tone={section === tab.id ? 'primary' : 'outline'}
            borderRadius={999}
            onPress={() => setSection(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </XStack>

      <YStack
        gap="$2"
        padding="$3"
        borderRadius={12}
        backgroundColor={ui.surfaceMuted}
        borderWidth={1}
        borderColor={ui.borderSubtle}
      >
        <Text fontSize={12} color={ui.textMuted}>
          Current selection
        </Text>
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          {getCountryName(countryCode)} ·{' '}
          {REGION_LANGUAGES.find((l) => l.code === languageCode)?.label ?? languageCode} ·{' '}
          {currencyCode}
        </Text>
      </YStack>

      {section === 'country' ? (
        <YStack gap="$2">
          <Text fontWeight="700" color={ui.text}>
            Ship to
          </Text>
          <Input
            value={countryQuery}
            onChangeText={setCountryQuery}
            placeholder="Search countries"
            autoCapitalize="none"
            height={44}
            borderRadius={12}
          />
          <YStack gap="$1" maxHeight={280}>
            {countries.map((country) => (
              <OptionRow
                key={country.isoCode}
                label={`${country.flag} ${country.name}`}
                meta={country.isoCode}
                selected={country.isoCode === countryCode}
                onPress={() => handleSelectCountry(country.isoCode)}
              />
            ))}
          </YStack>
        </YStack>
      ) : null}

      {section === 'language' ? (
        <YStack gap="$2">
          <Text fontWeight="700" color={ui.text}>
            Language
          </Text>
          {REGION_LANGUAGES.map((lang) => (
            <OptionRow
              key={lang.code}
              label={lang.label}
              meta={lang.code.toUpperCase()}
              selected={lang.code === languageCode}
              onPress={() => setLanguageCode(lang.code)}
            />
          ))}
        </YStack>
      ) : null}

      {section === 'currency' ? (
        <YStack gap="$2">
          <Text fontWeight="700" color={ui.text}>
            Currency
          </Text>
          <Text fontSize={12} color={ui.textMuted}>
            Suggested for {getCountryName(countryCode)}: {defaultCurrencyForCountry(countryCode)}
          </Text>
          {currencies.map((currency) => (
            <OptionRow
              key={currency.code}
              label={`${currency.symbol} ${currency.name}`}
              meta={currency.code}
              selected={currency.code === currencyCode}
              onPress={() => setCurrencyCode(currency.code)}
            />
          ))}
        </YStack>
      ) : null}
    </AppBottomSheet>
  )
}
