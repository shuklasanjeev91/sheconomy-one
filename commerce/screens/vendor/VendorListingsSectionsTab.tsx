import { useState } from 'react'

import { Button, Icons, Image, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import { MOCK_SECTION_STATS, MOCK_SHOP_SECTIONS, type MockShopSection } from './vendor-listings.mock'
import { ListingsCard } from './vendor-listings-shared'

type VendorListingsSectionsTabProps = {
  ui: AppUiTokens
  isDesktop: boolean
  safeBottom: number
}

export function VendorListingsSectionsTab({ ui, isDesktop, safeBottom }: VendorListingsSectionsTabProps) {
  const toast = useAppToast()
  const [expandedId, setExpandedId] = useState<string | null>(MOCK_SHOP_SECTIONS[0]?.id ?? null)

  function handleSave() {
    toast.show('Shop sections coming soon', {
      tone: 'info',
      message: 'Section management will be available after the shop sections migration.',
    })
  }

  return (
    <YStack gap="$4" width="100%">
      {/* Stats */}
      <XStack gap="$3" flexWrap="wrap">
        <StatCard ui={ui} label="Total Sections" value={String(MOCK_SECTION_STATS.totalSections)} />
        <StatCard ui={ui} label="Active Products" value={String(MOCK_SECTION_STATS.activeProducts)} />
        <StatCard ui={ui} label="Draft Products" value={String(MOCK_SECTION_STATS.draftProducts)} />
        <StatCard
          ui={ui}
          label="Unassigned"
          value={String(MOCK_SECTION_STATS.unassigned)}
          highlight
        />
        <StatCard ui={ui} label="Top Section" value={MOCK_SECTION_STATS.topSection} />
        <StatCard ui={ui} label="Avg. Per Section" value={String(MOCK_SECTION_STATS.avgPerSection)} />
      </XStack>

      {/* Section list */}
      <YStack gap="$3">
        {MOCK_SHOP_SECTIONS.map((section) => (
          <SectionCard
            key={section.id}
            ui={ui}
            section={section}
            expanded={expandedId === section.id}
            onToggle={() => setExpandedId((current) => (current === section.id ? null : section.id))}
          />
        ))}
      </YStack>

      {/* Bottom save bar */}
      <XStack
        style={isDesktop ? ({ position: 'sticky', bottom: 0 } as const) : undefined}
        alignItems="center"
        justifyContent={isDesktop ? 'space-between' : 'stretch'}
        gap="$3"
        paddingTop="$3"
        paddingBottom={16 + safeBottom}
        borderTopWidth={1}
        borderTopColor={ui.borderSubtle}
        backgroundColor={ui.background}
        zIndex={10}
      >
        {isDesktop ? (
          <Text fontSize={12} color={ui.textMuted}>
            Preview data only — section editing arrives with the shop sections migration.
          </Text>
        ) : null}
        <Button
          tone="primary"
          size="$4"
          borderRadius={999}
          flex={isDesktop ? undefined : 1}
          onPress={handleSave}
        >
          Save Changes
        </Button>
      </XStack>
    </YStack>
  )
}

function StatCard({
  ui,
  label,
  value,
  highlight,
}: {
  ui: AppUiTokens
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <YStack
      flex={1}
      minWidth={isDesktopMinWidth(label) ? 150 : 140}
      gap="$1"
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Text fontSize={11} fontWeight="700" color={ui.textMuted} letterSpacing={0.4}>
        {label.toUpperCase()}
      </Text>
      <Text fontSize={22} fontWeight="800" color={highlight ? '#C58A00' : ui.text} letterSpacing={-0.5}>
        {value}
      </Text>
    </YStack>
  )
}

function isDesktopMinWidth(_label: string) {
  return true
}

function SectionCard({
  ui,
  section,
  expanded,
  onToggle,
}: {
  ui: AppUiTokens
  section: MockShopSection
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <ListingsCard ui={ui}>
      <XStack alignItems="center" gap="$3">
        <Icons.GripVertical size={18} color={ui.textMuted} />
        <YStack flex={1} minWidth={0} gap={4}>
          <XStack alignItems="center" gap="$2" flexWrap="wrap">
            <Text fontSize={16} fontWeight="800" color={ui.text}>
              {section.title}
            </Text>
            {section.tag ? (
              <XStack
                paddingHorizontal="$2"
                paddingVertical={3}
                borderRadius={999}
                backgroundColor={ui.roseSurface}
              >
                <Text fontSize={10.5} fontWeight="800" color={ui.brand}>
                  {section.tag}
                </Text>
              </XStack>
            ) : null}
            <Text fontSize={12.5} color={ui.textMuted} fontWeight="600">
              {section.itemCount} Items
            </Text>
          </XStack>
          {expanded ? (
            <Text fontSize={12} color={ui.textSecondary}>
              {section.activeCount} Active · {section.draftCount} Draft · Last updated: {section.lastUpdated}
            </Text>
          ) : null}
        </YStack>
        <XStack gap="$2" alignItems="center">
          <YStack
            width={32}
            height={32}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          >
            <Icons.Pencil size={15} color={ui.textSecondary} />
          </YStack>
          <YStack
            width={32}
            height={32}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
            onPress={onToggle}
          >
            {expanded ? (
              <Icons.ChevronUp size={18} color={ui.textSecondary} />
            ) : (
              <Icons.ChevronDown size={18} color={ui.textSecondary} />
            )}
          </YStack>
        </XStack>
      </XStack>

      {expanded ? (
        <XStack gap="$4" flexWrap="wrap" marginTop="$2">
          <YStack flex={1} minWidth={260} gap="$2.5">
            <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.5}>
              ACTIVE ({section.activeCount})
            </Text>
            {section.activeProducts.map((product) => (
              <XStack
                key={product.id}
                alignItems="center"
                gap="$3"
                padding="$2.5"
                borderRadius={radius.chip}
                backgroundColor={ui.surfaceMuted}
              >
                <YStack
                  width={40}
                  height={40}
                  borderRadius={radius.chip}
                  overflow="hidden"
                  backgroundColor={ui.surface}
                  alignItems="center"
                  justifyContent="center"
                >
                  {product.imageUrl ? (
                    <Image src={product.imageUrl} width={40} height={40} objectFit="cover" alt="" />
                  ) : (
                    <Icons.Image size={16} color={ui.textMuted} />
                  )}
                </YStack>
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                    {product.title}
                  </Text>
                  <Text fontSize={12} color={ui.textSecondary} fontWeight="600">
                    {product.price}
                  </Text>
                </YStack>
                <Icons.MoreVertical size={15} color={ui.textMuted} />
              </XStack>
            ))}
            {section.activeProducts.length > 0 ? (
              <Text fontSize={12} fontWeight="700" color={ui.brand} cursor="pointer">
                View all active…
              </Text>
            ) : (
              <Text fontSize={12} color={ui.textMuted}>
                No active products in this section yet.
              </Text>
            )}
          </YStack>

          <YStack flex={1} minWidth={260} gap="$2.5">
            <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.5}>
              DRAFTS ({section.draftCount})
            </Text>
            {section.draftProducts.map((product) => (
              <XStack
                key={product.id}
                alignItems="center"
                gap="$3"
                padding="$2.5"
                borderRadius={radius.chip}
                backgroundColor={ui.surfaceMuted}
              >
                <YStack
                  width={40}
                  height={40}
                  borderRadius={radius.chip}
                  backgroundColor={ui.surface}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icons.Image size={16} color={ui.textMuted} />
                </YStack>
                <YStack flex={1} minWidth={0}>
                  <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                    {product.title}
                  </Text>
                  <Text fontSize={12} color={ui.textSecondary} fontWeight="600">
                    {product.note ?? 'Draft'}
                  </Text>
                </YStack>
              </XStack>
            ))}
            {section.draftProducts.length === 0 ? (
              <Text fontSize={12} color={ui.textMuted}>
                No draft products in this section.
              </Text>
            ) : null}
          </YStack>
        </XStack>
      ) : null}
    </ListingsCard>
  )
}
