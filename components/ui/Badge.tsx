import type { ReactNode } from 'react'
import type { GetProps, ThemeName } from 'tamagui'
import { Theme, XStack } from 'tamagui'
import { SizableText } from '~/components/ui/Text'

import { BRAND_THEME, radius } from '~/config/tokens'

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

export type BadgeProps = GetProps<typeof XStack> & {
  tone?: BadgeTone
  size?: 'sm' | 'md'
  children?: ReactNode
}

const TONE_THEME: Partial<Record<BadgeTone, ThemeName>> = {
  neutral: undefined,
  brand: BRAND_THEME,
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  info: 'blue',
}

const TONE_STYLE: Partial<Record<BadgeTone, GetProps<typeof XStack>>> = {
  neutral: {
    backgroundColor: '$color2',
    borderColor: '$borderColor',
  },
  brand: {
    backgroundColor: '$color3',
    borderColor: '$color5',
  },
}

/** Small pill for statuses, counts and tags. */
export function Badge({
  tone = 'neutral',
  size = 'md',
  children,
  ...props
}: BadgeProps) {
  const themeName = TONE_THEME[tone]
  const frame = (
    <XStack
      alignItems="center"
      alignSelf="flex-start"
      borderRadius={radius.pill}
      borderWidth={1}
      paddingHorizontal={size === 'sm' ? '$2.5' : '$3'}
      paddingVertical={size === 'sm' ? 4 : '$1.5'}
      {...TONE_STYLE[tone]}
      {...props}
    >
      <SizableText
        size={size === 'sm' ? '$1' : '$2'}
        fontWeight="600"
        color="$color11"
        textTransform="capitalize"
        letterSpacing={0.2}
      >
        {children}
      </SizableText>
    </XStack>
  )

  if (themeName) {
    return <Theme name={themeName}>{frame}</Theme>
  }

  return frame
}