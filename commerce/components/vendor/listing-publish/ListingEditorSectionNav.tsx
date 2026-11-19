import { Platform } from 'react-native'

import { Text, YStack } from '~/components/ui'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  LISTING_EDITOR_SECTIONS,
  type ListingEditorSectionId,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'

type ListingEditorSectionNavProps = {
  ui: AppUiTokens
  activeSection: ListingEditorSectionId
  /** Hide Variants until product type is Variable / Grouped. */
  showVariants: boolean
  onSelect: (section: ListingEditorSectionId) => void
}

export function ListingEditorSectionNav({
  ui,
  activeSection,
  showVariants,
  onSelect,
}: ListingEditorSectionNavProps) {
  const sections = LISTING_EDITOR_SECTIONS.filter(
    (section) => section.id !== 'variants' || showVariants,
  )

  return (
    <YStack
      width="100%"
      gap={2}
      padding="$3"
      borderRadius={16}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      style={
        Platform.OS === 'web'
          ? ({ position: 'sticky', top: 88, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' } as const)
          : undefined
      }
    >
      <Text
        fontSize={11}
        fontWeight="800"
        color={ui.textMuted}
        letterSpacing={0.6}
        textTransform="uppercase"
        paddingHorizontal="$2"
        paddingBottom="$2"
      >
        On this page
      </Text>
      {sections.map((section) => {
        const active = section.id === activeSection
        return (
          <YStack
            key={section.id}
            paddingVertical="$2.5"
            paddingHorizontal="$3"
            borderRadius={10}
            backgroundColor={active ? ui.roseSurface : 'transparent'}
            borderWidth={active ? 1 : 0}
            borderColor={active ? ui.brand : 'transparent'}
            cursor="pointer"
            onPress={() => onSelect(section.id)}
            hoverStyle={{ backgroundColor: ui.surfaceMuted }}
          >
            <Text fontSize={13} fontWeight={active ? '800' : '600'} color={active ? ui.brand : ui.text}>
              {section.label}
            </Text>
            {section.hint ? (
              <Text fontSize={11} color={ui.textMuted} lineHeight={15} marginTop={2}>
                {section.hint}
              </Text>
            ) : null}
          </YStack>
        )
      })}
    </YStack>
  )
}
