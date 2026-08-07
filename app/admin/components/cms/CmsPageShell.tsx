import type { ReactNode } from 'react'
import { usePathname, useRouter, type Href } from 'one'

import {
  Icons,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Text,
  XStack,
  YStack,
} from '~/components/ui'
import { getShadowStyle, radius } from '~/config/tokens'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useAppUi } from '~/lib/theme/useAppUi'

import { CMS_NAV_ITEMS, getCmsSectionFromPath } from './cmsNav'

export function CmsPageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const ui = useAppUi()
  const router = useRouter()
  const pathname = usePathname()
  const { isDesktop, safeBottom } = useAppLayout()
  const activeSection = getCmsSectionFromPath(pathname)
  const activeItem = CMS_NAV_ITEMS.find((item) => item.id === activeSection) ?? CMS_NAV_ITEMS[0]

  return (
    <YStack
      gap="$4"
      paddingHorizontal={isDesktop ? '$6' : '$4'}
      paddingTop={isDesktop ? '$6' : '$4'}
      paddingBottom={safeBottom + 28}
      width="100%"
      maxWidth={1280}
      alignSelf="center"
    >
      <YStack
        gap="$3"
        padding="$4"
        borderRadius={radius.card}
        backgroundColor={ui.surface}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        style={getShadowStyle('sm')}
      >
        <XStack
          justifyContent="space-between"
          alignItems="flex-start"
          gap="$3"
          flexWrap="wrap"
        >
          <YStack gap="$1" flex={1} minWidth={220}>
            <Text fontSize={12} fontWeight="700" color={ui.textMuted} letterSpacing={0.5}>
              CMS
            </Text>
            <Text fontSize={isDesktop ? 26 : 22} fontWeight="800" color={ui.text}>
              {title}
            </Text>
            {subtitle ? (
              <Text fontSize={14} color={ui.textSecondary}>
                {subtitle}
              </Text>
            ) : null}
          </YStack>
          {actions ? (
            <XStack gap="$2" flexWrap="wrap" alignItems="center">
              {actions}
            </XStack>
          ) : null}
        </XStack>

        <YStack gap="$2" maxWidth={isDesktop ? 360 : '100%'}>
          <Text fontSize={12} fontWeight="600" color={ui.textMuted}>
            Section
          </Text>
          <Select
            value={activeItem.id}
            onValueChange={(value) => {
              const next = CMS_NAV_ITEMS.find((item) => item.id === value)
              if (next) router.push(next.href)
            }}
          >
            <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} />}>
              <Select.Value placeholder="Choose CMS section" />
            </SelectTrigger>
            <SelectContent zIndex={300000}>
              <SelectViewport maxHeight={360}>
                {CMS_NAV_ITEMS.map((item, index) => (
                  <SelectItem key={item.id} index={index} value={item.id}>
                    <Select.ItemText>{item.label}</Select.ItemText>
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
        </YStack>

        {isDesktop ? (
          <XStack gap="$2" flexWrap="wrap">
            {CMS_NAV_ITEMS.map((item) => {
              const active = item.id === activeSection
              const Icon = item.icon
              return (
                <XStack
                  key={item.id}
                  alignItems="center"
                  gap="$2"
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderRadius={radius.chip}
                  borderWidth={1}
                  borderColor={active ? ui.brand : ui.borderSubtle}
                  backgroundColor={active ? ui.brand : ui.surfaceMuted}
                  cursor="pointer"
                  hoverStyle={{ opacity: 0.9 }}
                  onPress={() => router.push(item.href)}
                >
                  <Icon size={14} color={active ? ui.onBrand : ui.textSecondary} />
                  <Text fontSize={13} fontWeight="600" color={active ? ui.onBrand : ui.text}>
                    {item.label}
                  </Text>
                </XStack>
              )
            })}
          </XStack>
        ) : null}
      </YStack>

      {children}
    </YStack>
  )
}

export function CmsPanel({
  children,
  gap = '$3',
}: {
  children: ReactNode
  gap?: string | number
}) {
  const ui = useAppUi()
  return (
    <YStack
      gap={gap as any}
      padding="$4"
      borderRadius={radius.card}
      backgroundColor={ui.surface}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      style={getShadowStyle('sm')}
    >
      {children}
    </YStack>
  )
}

export function CmsPickerSelect({
  value,
  options,
  placeholder,
  onValueChange,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} />}>
        <Select.Value placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent zIndex={300000}>
        <SelectViewport maxHeight={320}>
          {options.map((option, index) => (
            <SelectItem key={option.value} index={index} value={option.value}>
              <Select.ItemText>{option.label}</Select.ItemText>
            </SelectItem>
          ))}
        </SelectViewport>
      </SelectContent>
    </Select>
  )
}

export function CmsInlineConfirm({
  title,
  description,
  confirmLabel = 'Confirm',
  tone = 'danger',
  loading,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel?: string
  tone?: 'danger' | 'warning'
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const ui = useAppUi()
  return (
    <YStack
      gap="$3"
      padding="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.roseSurface}
    >
      <YStack gap="$1">
        <Text fontSize={15} fontWeight="700" color={ui.text}>
          {title}
        </Text>
        <Text fontSize={13} color={ui.textSecondary}>
          {description}
        </Text>
      </YStack>
      <XStack gap="$2" flexWrap="wrap">
        <ButtonLike tone="ghost" label="Cancel" onPress={onCancel} disabled={loading} />
        <ButtonLike
          tone={tone === 'danger' ? 'danger' : 'primary'}
          label={confirmLabel}
          onPress={onConfirm}
          disabled={loading}
        />
      </XStack>
    </YStack>
  )
}

function ButtonLike({
  label,
  onPress,
  tone,
  disabled,
}: {
  label: string
  onPress: () => void
  tone: 'ghost' | 'danger' | 'primary'
  disabled?: boolean
}) {
  const ui = useAppUi()
  const bg =
    tone === 'danger' ? ui.danger : tone === 'primary' ? ui.brand : 'transparent'
  const color = tone === 'ghost' ? ui.text : ui.onBrand
  return (
    <XStack
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderRadius={radius.chip}
      backgroundColor={bg}
      borderWidth={tone === 'ghost' ? 1 : 0}
      borderColor={ui.borderSubtle}
      opacity={disabled ? 0.6 : 1}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      onPress={disabled ? undefined : onPress}
    >
      <Text fontSize={13} fontWeight="700" color={color}>
        {label}
      </Text>
    </XStack>
  )
}

export function cmsEditHref(id: string): Href {
  return `/admin/cms/${id}` as Href
}
