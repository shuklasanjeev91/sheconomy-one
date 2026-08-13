import { Platform, useWindowDimensions } from 'react-native'

import { Icons, ScrollView, Text, XStack, YStack } from '~/components/ui'
import type { AppUiTokens } from '~/lib/theme/app-ui'

import {
  LISTING_PUBLISH_STEPS,
  type ListingPublishStepConfig,
  type ListingPublishStepId,
} from '~/commerce/components/vendor/listing-publish/listing-publish.constants'

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

/** Below this the six steps can't share a row legibly, so they scroll instead. */
const STEP_SPREAD_MIN_WIDTH = 700

type ListingPublishStepNavProps = {
  ui: AppUiTokens
  activeStep: ListingPublishStepId
  /** Highest step the vendor has unlocked — later steps are not tappable yet. */
  furthestStepIndex: number
  onSelect: (step: ListingPublishStepId) => void
  isDesktop: boolean
}

export function ListingPublishStepNav({
  ui,
  activeStep,
  furthestStepIndex,
  onSelect,
  isDesktop,
}: ListingPublishStepNavProps) {
  const { width } = useWindowDimensions()
  const spread = isDesktop || width >= STEP_SPREAD_MIN_WIDTH

  const tabs = (
    <XStack
      width="100%"
      gap={spread ? '$2' : '$3'}
      flexWrap="nowrap"
      paddingBottom="$1"
      borderBottomWidth={1}
      borderBottomColor={ui.borderSubtle}
      justifyContent={spread ? 'space-between' : 'flex-start'}
    >
      {LISTING_PUBLISH_STEPS.map((step, index) => {
        const active = step.id === activeStep
        const done = index < furthestStepIndex
        const locked = index > furthestStepIndex
        return (
          <XStack
            key={step.id}
            alignItems="center"
            justifyContent="center"
            gap={6}
            flex={spread ? 1 : undefined}
            minWidth={spread ? 0 : undefined}
            paddingBottom="$2.5"
            borderBottomWidth={active ? 2 : 0}
            borderBottomColor={active ? ui.brand : 'transparent'}
            cursor={locked ? 'not-allowed' : 'pointer'}
            opacity={active ? 1 : locked ? 0.4 : 0.72}
            flexShrink={spread ? 1 : 0}
            onPress={() => onSelect(step.id)}
            hoverStyle={{ opacity: locked ? 0.4 : 1 }}
          >
            {done && !active ? (
              <Icons.CheckCircle2 size={15} color={ui.brand} />
            ) : (
              stepIcon(step.iconName, active ? ui.brand : ui.textMuted)
            )}
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

  if (spread) return tabs

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
  isDesktop?: boolean
}

export function ListingPublishPageHeader({
  ui,
  headline,
  subtitle,
  isDesktop = true,
}: ListingPublishPageHeaderProps) {
  return (
    <YStack gap="$1.5" marginBottom={isDesktop ? '$2' : '$1'}>
      <Text
        fontSize={isDesktop ? 28 : 22}
        fontWeight="800"
        color={ui.text}
        letterSpacing={-0.6}
        fontFamily="$heading"
      >
        {headline}
      </Text>
      <Text fontSize={14} color={ui.textSecondary} lineHeight={21} maxWidth="100%">
        {subtitle}
      </Text>
    </YStack>
  )
}
