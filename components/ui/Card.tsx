import { styled, Card as TCard } from 'tamagui'
import { getShadowStyle, radius } from '~/config/tokens'

/**
 * Surface for grouping content — a softly-elevated, rounded panel that
 * respects light/dark themes automatically since it uses theme tokens
 * (`$background`, `$borderColor`) rather than hardcoded colors.
 */
export const Card = styled(TCard, {
  name: 'Card',
  backgroundColor: '$background',
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: '$borderColor',
  padding: '$4.5',
  gap: '$3.5',
  ...getShadowStyle('sm'),

  variants: {
    elevated: {
      true: {
        ...getShadowStyle('md'),
        borderWidth: 1,
        borderColor: '$color4',
        backgroundColor: '$background',
      },
    },
    interactive: {
      true: {
        animation: 'smooth',
        cursor: 'pointer',
        hoverStyle: {
          ...getShadowStyle('md'),
          borderColor: '$color6',
          y: -2,
        },
        pressStyle: { ...getShadowStyle('sm'), y: 0, scale: 0.992 },
      },
    },
    bordered: {
      false: { borderWidth: 0 },
    },
    compact: {
      true: {
        padding: '$3',
        gap: '$2',
        borderRadius: radius.chip,
      },
    },
  } as const,
})

export const CardHeader = TCard.Header
export const CardFooter = TCard.Footer
export const CardBackground = TCard.Background

export type CardProps = React.ComponentProps<typeof Card>
