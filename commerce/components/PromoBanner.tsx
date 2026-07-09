import { Link } from 'one'
import type { Href } from 'one'

import { Text, YStack } from '~/components/ui'
import { useAppUi } from '~/lib/theme/useAppUi'

type PromoBannerProps = {
  title: string
  subtitle: string
  cta: string
  href?: Href
  backgroundColor?: string
}

/** Etsy-style editorial promo card in the home row. */
export function PromoBanner({
  title,
  subtitle,
  cta,
  href = '/',
  backgroundColor,
}: PromoBannerProps) {
  const ui = useAppUi()

  return (
    <Link href={href} asChild>
      <YStack
        flex={1}
        minWidth={200}
        maxWidth={320}
        height={140}
        borderRadius={8}
        backgroundColor={backgroundColor ?? ui.roseSurface}
        padding="$4"
        justifyContent="space-between"
        cursor="pointer"
        hoverStyle={{ opacity: 0.92 }}
        pressStyle={{ scale: 0.99 }}
      >
        <YStack gap="$1">
          <Text fontWeight="500" fontSize={16} color={ui.text} numberOfLines={2} lineHeight={20}>
            {title}
          </Text>
          <Text fontSize={12} color={ui.textSecondary} numberOfLines={2} lineHeight={16}>
            {subtitle}
          </Text>
        </YStack>
        <Text fontSize={13} fontWeight="500" color={ui.text} textDecorationLine="underline">
          {cta}
        </Text>
      </YStack>
    </Link>
  )
}