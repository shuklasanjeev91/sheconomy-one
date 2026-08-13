import { useState } from 'react'
import type { ReactNode } from 'react'

import { Icons, Popover, PopoverContent, Text, XStack, YStack } from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import type { ListingStatus, ListingType } from '~/lib/listing/listing.type'
import {
  LISTING_STATUS,
  LISTING_STATUS_OPTIONS,
  LISTING_TYPE_OPTIONS,
  LISTING_TYPE_OPTIONS_SELECTABLE,
} from '~/lib/listing/listing.type'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type IconType = (typeof Icons)[keyof typeof Icons]

export function ListingsCard({ ui, children }: { ui: AppUiTokens; children: ReactNode }) {
  return (
    <YStack
      gap="$3.5"
      padding="$5"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={getShadowStyle('sm')}
    >
      {children}
    </YStack>
  )
}

export function ListingsFilterDropdown({
  ui,
  label,
  options,
  value,
  onChange,
}: {
  ui: AppUiTokens
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)?.label ?? label

  return (
    <Popover open={open} onOpenChange={setOpen} placement="bottom-end" allowFlip>
      <Popover.Trigger asChild>
        <XStack
          alignItems="center"
          gap="$2"
          paddingHorizontal="$3"
          height={44}
          minWidth={140}
          borderRadius={radius.chip}
          borderWidth={1}
          borderColor={ui.borderSubtle}
          backgroundColor={ui.surfaceMuted}
          cursor="pointer"
          hoverStyle={{ borderColor: ui.brand }}
          pressStyle={{ opacity: 0.8 }}
        >
          <Text flex={1} fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
            {selected}
          </Text>
          <Icons.ChevronDown size={15} color={ui.textMuted} />
        </XStack>
      </Popover.Trigger>
      <PopoverContent>
        <YStack minWidth={180} gap={2}>
          {options.map((option) => {
            const active = option.value === value
            return (
              <XStack
                key={option.value}
                alignItems="center"
                justifyContent="space-between"
                gap="$2"
                paddingHorizontal="$3"
                paddingVertical="$2.5"
                borderRadius={radius.chip}
                cursor="pointer"
                backgroundColor={active ? ui.roseSurface : 'transparent'}
                hoverStyle={{ backgroundColor: ui.surfaceMuted }}
                onPress={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <Text fontSize={13} fontWeight={active ? '800' : '600'} color={active ? ui.brand : ui.text}>
                  {option.label}
                </Text>
                {active ? <Icons.Check size={15} color={ui.brand} /> : null}
              </XStack>
            )
          })}
        </YStack>
      </PopoverContent>
    </Popover>
  )
}

export function ListingsPagerButton({
  ui,
  icon,
  disabled,
  onPress,
}: {
  ui: AppUiTokens
  icon: IconType
  disabled?: boolean
  onPress: () => void
}) {
  const Icon = icon
  return (
    <YStack
      width={34}
      height={34}
      borderRadius={999}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      alignItems="center"
      justifyContent="center"
      backgroundColor={ui.surface}
      opacity={disabled ? 0.4 : 1}
      cursor={disabled ? 'default' : 'pointer'}
      hoverStyle={disabled ? undefined : { borderColor: ui.brand }}
      pressStyle={disabled ? undefined : { opacity: 0.7 }}
      onPress={disabled ? undefined : onPress}
    >
      <Icon size={16} color={ui.textSecondary} />
    </YStack>
  )
}

export const LISTING_TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  ...LISTING_TYPE_OPTIONS_SELECTABLE.map((option) => ({ value: option.value, label: option.label })),
]

export const LISTING_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  ...LISTING_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
]

export function listingTypeLabel(type: ListingType | string | null | undefined): string {
  return LISTING_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? String(type ?? 'Product')
}

export function listingStatusLabel(status: ListingStatus | string | null | undefined): string {
  return LISTING_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? String(status ?? 'Unknown')
}

export function listingStatusTone(status: ListingStatus | string | null | undefined): 'success' | 'warning' | 'neutral' | 'danger' {
  if (status === LISTING_STATUS.ACTIVE) return 'success'
  if (status === LISTING_STATUS.DRAFT) return 'warning'
  if (status === LISTING_STATUS.PAUSED) return 'warning'
  if (status === LISTING_STATUS.SOLD_OUT) return 'danger'
  if (status === LISTING_STATUS.ARCHIVED) return 'neutral'
  return 'neutral'
}

/** Row-menu status actions (excludes the listing's current status). */
export const LISTING_STATUS_ACTIONS: readonly {
  value: ListingStatus
  label: string
  icon: IconType
  tone?: 'danger' | 'warning' | 'success' | 'neutral'
}[] = [
  { value: LISTING_STATUS.ACTIVE, label: 'Publish', icon: Icons.CheckCircle2, tone: 'success' },
  { value: LISTING_STATUS.DRAFT, label: 'Set to Draft', icon: Icons.FileText, tone: 'neutral' },
  { value: LISTING_STATUS.PAUSED, label: 'Pause', icon: Icons.Pause, tone: 'warning' },
  { value: LISTING_STATUS.SOLD_OUT, label: 'Mark Sold Out', icon: Icons.ShoppingBag, tone: 'danger' },
  { value: LISTING_STATUS.ARCHIVED, label: 'Archive', icon: Icons.Archive, tone: 'danger' },
]

export function listingStatusActionsFor(
  currentStatus: ListingStatus | string | null | undefined,
): typeof LISTING_STATUS_ACTIONS[number][] {
  return LISTING_STATUS_ACTIONS.filter((action) => action.value !== currentStatus)
}

export function listingSkuFallback(slug: string | null | undefined, id: string): string {
  if (slug) return slug.toUpperCase().replace(/-/g, '-').slice(0, 24)
  return id.slice(0, 8).toUpperCase()
}
