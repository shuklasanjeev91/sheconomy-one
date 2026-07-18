import { Platform } from 'react-native'

import { Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  LISTING_PUBLISH_STEPS,
  type ListingPublishStepConfig,
  type ListingPublishStepId,
} from './listing-publish.constants'

function stepIcon(iconName: ListingPublishStepConfig['iconName'], color: string, size = 15) {
  switch (iconName) {
    case 'info':
      return <Icons.Info size={size} color={color} />
    case 'layers':
      return <Icons.Layers size={size} color={color} />
    case 'indian-rupee':
      return <Icons.IndianRupee size={size} color={color} />
    case 'tags':
      return <Icons.Tags size={size} color={color} />
    case 'image':
      return <Icons.Image size={size} color={color} />
    case 'search':
      return <Icons.Search size={size} color={color} />
    default:
      return <Icons.Circle size={size} color={color} />
  }
}

type ListingPublishStepNavProps = {
  ui: AppUiTokens
  activeStep: ListingPublishStepId
  onSelect: (step: ListingPublishStepId) => void
  isDesktop: boolean
}

export function ListingPublishStepNav({ ui, activeStep, onSelect, isDesktop }: ListingPublishStepNavProps) {
  const tabs = (
    <XStack
      width="100%"
      gap={isDesktop ? '$2' : '$3'}
      flexWrap="nowrap"
      paddingBottom="$1"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      justifyContent={isDesktop ? 'space-between' : 'flex-start'}
    >
      {LISTING_PUBLISH_STEPS.map((step) => {
        const active = step.id === activeStep
        return (
          <XStack
            key={step.id}
            alignItems="center"
            justifyContent="center"
            gap={6}
            flex={isDesktop ? 1 : undefined}
            minWidth={isDesktop ? 0 : undefined}
            paddingBottom="$2.5"
            borderBottomWidth={active ? 2 : 0}
            borderBottomColor={active ? ui.brand : 'transparent'}
            cursor="pointer"
            opacity={active ? 1 : 0.72}
            flexShrink={isDesktop ? 1 : 0}
            onPress={() => onSelect(step.id)}
            hoverStyle={{ opacity: 1 }}
          >
            {stepIcon(step.iconName, active ? ui.brand : ui.textMuted)}
            <Text
              fontSize={13}
              fontWeight={active ? '800' : '600'}
              color={active ? ui.brand : ui.textSecondary}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </XStack>
        )
      })}
    </XStack>
  )

  if (isDesktop) return tabs

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={
        Platform.OS === 'web'
          ? ({
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            } as const)
          : undefined
      }
    >
      {tabs}
    </ScrollView>
  )
}

type ListingPublishPageHeaderProps = {
  ui: AppUiTokens
  headline: string
  subtitle: string
}

export function ListingPublishPageHeader({ ui, headline, subtitle }: ListingPublishPageHeaderProps) {
  return (
    <YStack gap="$1.5" marginBottom="$2">
      <Text fontSize={28} fontWeight="800" color={ui.text} letterSpacing={-0.6} fontFamily="$heading">
        {headline}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} lineHeight={21} maxWidth={720}>
        {subtitle}
      </Text>
    </YStack>
  )
}
