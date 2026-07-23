import { useCallback, useEffect, useState } from 'react'

import {
  Button,
  Icons,
  Input,
  Spinner,
  Text,
  TextArea,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { radius } from '~/config/tokens'
import type { AppUiTokens } from '~/lib/theme/app-ui'
import { useAppUi } from '~/lib/theme/useAppUi'
import {
  fetchVendorShopSections,
  saveVendorShopSection,
  type VendorShopSection,
} from '~/commerce/lib/vendor-operations'

type VendorListingsSectionsTabProps = {
  ui: AppUiTokens
  shopId: string
  isDesktop: boolean
  safeBottom: number
}

export function VendorListingsSectionsTab({
  ui,
  shopId,
  isDesktop,
  safeBottom,
}: VendorListingsSectionsTabProps) {
  const toast = useAppToast()
  const [sections, setSections] = useState<VendorShopSection[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [listingDrafts, setListingDrafts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setSections(await fetchVendorShopSections(shopId))
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  function parseListingIds(raw: string) {
    return [
      ...new Set(
        raw
          .split(/[\s,]+/)
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ]
  }

  async function createSection() {
    if (name.trim().length < 2) {
      toast.show('Add a section name', { tone: 'danger' })
      return
    }
    const result = await saveVendorShopSection({
      shopId,
      name,
      description,
    })
    if (result.error) {
      toast.show('Could not save section', { tone: 'danger', message: result.error })
      return
    }
    setName('')
    setDescription('')
    toast.show('Section created', { tone: 'success' })
    await load()
  }

  async function toggleSection(section: VendorShopSection) {
    const result = await saveVendorShopSection({
      shopId,
      sectionId: section.id,
      name: section.name,
      description: section.description,
      active: !section.active,
      listingIds: section.listingIds,
    })
    if (result.error) {
      toast.show('Could not update section', { tone: 'danger', message: result.error })
      return
    }
    await load()
  }

  async function saveListingAssignments(section: VendorShopSection) {
    const listingIds = parseListingIds(
      listingDrafts[section.id] ?? section.listingIds.join(', '),
    )
    const result = await saveVendorShopSection({
      shopId,
      sectionId: section.id,
      name: section.name,
      description: section.description,
      active: section.active,
      listingIds,
    })
    if (result.error) {
      toast.show('Could not update products', { tone: 'danger', message: result.error })
      return
    }
    toast.show('Section products updated', { tone: 'success' })
    await load()
  }

  if (loading) {
    return (
      <YStack minHeight={240} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </YStack>
    )
  }

  return (
    <YStack gap="$4" width="100%" paddingBottom={safeBottom}>
      <YStack
        gap="$3"
        padding="$4"
        borderRadius={radius.card}
        borderWidth={1}
        borderColor={ui.borderSubtle}
        backgroundColor={ui.surface}
      >
        <Text fontSize={16} fontWeight="800" color={ui.text}>
          Create section
        </Text>
        <XStack gap="$2" flexWrap="wrap" alignItems="flex-end">
          <Input
            flex={1}
            minWidth={isDesktop ? 220 : '100%'}
            placeholder="Section name"
            value={name}
            onChangeText={setName}
          />
          <TextArea
            flex={2}
            minWidth={isDesktop ? 280 : '100%'}
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
          />
          <Button tone="primary" size="$3" icon={<Icons.Plus size={15} />} onPress={createSection}>
            Add section
          </Button>
        </XStack>
      </YStack>

      <XStack gap="$3" flexWrap="wrap">
        <Stat label="Sections" value={String(sections.length)} />
        <Stat label="Active" value={String(sections.filter((row) => row.active).length)} />
        <Stat
          label="Assigned products"
          value={String(new Set(sections.flatMap((row) => row.listingIds)).size)}
        />
      </XStack>

      {sections.length ? (
        sections.map((section) => (
          <YStack
            key={section.id}
            padding="$4"
            gap="$3"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
          >
            <XStack alignItems="center" justifyContent="space-between" gap="$3">
              <YStack flex={1} minWidth={0}>
                <Text fontSize={15} fontWeight="800" color={ui.text}>
                  {section.name}
                </Text>
                <Text fontSize={12} color={ui.textSecondary}>
                  {section.listingIds.length} products · {section.active ? 'Visible' : 'Hidden'}
                </Text>
              </YStack>
              <Button tone="outline" size="$3" onPress={() => void toggleSection(section)}>
                {section.active ? 'Hide' : 'Show'}
              </Button>
            </XStack>
            {section.description ? (
              <Text fontSize={13} color={ui.textSecondary}>
                {section.description}
              </Text>
            ) : null}
            <YStack gap="$2">
              <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
                LISTING IDS (comma-separated)
              </Text>
              <TextArea
                value={listingDrafts[section.id] ?? section.listingIds.join(', ')}
                onChangeText={(value) =>
                  setListingDrafts((current) => ({ ...current, [section.id]: value }))
                }
                placeholder="Paste listing UUIDs to include in this collection"
                minHeight={64}
              />
              <Button
                tone="primary"
                size="$3"
                alignSelf="flex-start"
                onPress={() => void saveListingAssignments(section)}
              >
                Save products
              </Button>
            </YStack>
          </YStack>
        ))
      ) : (
        <YStack minHeight={180} alignItems="center" justifyContent="center" gap="$2">
          <Icons.LayoutList size={30} color={ui.textMuted} />
          <Text color={ui.textSecondary}>Create your first persistent storefront section.</Text>
        </YStack>
      )}
    </YStack>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const ui = useAppUi()
  return (
    <YStack
      flex={1}
      minWidth={140}
      padding="$4"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
    >
      <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
        {label.toUpperCase()}
      </Text>
      <Text fontSize={21} fontWeight="800" color={ui.text}>
        {value}
      </Text>
    </YStack>
  )
}
