import { Icons, Text, XStack, YStack } from '~/components/ui'
import { AppLink } from '~/components/navigation/AppLink'
import { AI_NAME } from '~/config/brand'
import { radius } from '~/config/tokens'
import { helpHref, helpProductLabel, type HelpProduct } from '~/lib/help/types'
import type { AiProduct } from '~/lib/ai'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssistOptional } from '~/providers/AiAssistProvider'
import { useSupabase } from '~/providers/SupabaseProvider'

type ProductHelpBannerProps = {
  product: Exclude<HelpProduct, ''>
  /** Optional article slug deep link for Help. */
  articleSlug?: string
  /** AI product override when it differs from help product (e.g. account). */
  aiProduct?: AiProduct
  contextPage?: string
  title?: string
}

/**
 * Compact Help + Ask AI strip for product homes and secondary surfaces.
 */
export function ProductHelpBanner({
  product,
  articleSlug,
  aiProduct,
  contextPage = 'home',
  title,
}: ProductHelpBannerProps) {
  const ui = useAppUi()
  const { user } = useSupabase()
  const ai = useAiAssistOptional()
  const label = helpProductLabel(product)
  const href = helpHref(product, articleSlug)

  return (
    <XStack
      width="100%"
      alignItems="center"
      gap="$3"
      paddingHorizontal="$3.5"
      paddingVertical="$3"
      borderRadius={radius.card}
      borderWidth={1}
      borderColor={ui.borderSubtle}
      backgroundColor={ui.surface}
      flexWrap="wrap"
    >
      <Icons.HelpCircle size={18} color={ui.brand} />
      <YStack flex={1} minWidth={160} gap={2}>
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          {title ?? `Help for ${label}`}
        </Text>
        <Text fontSize={12} color={ui.textMuted}>
          Guides, contact support, or ask {user ? AI_NAME : 'after sign-in'}
        </Text>
      </YStack>
      <AppLink href={href as never}>
        <Text fontSize={13} fontWeight="700" color={ui.brand}>
          Open Help
        </Text>
      </AppLink>
      {user && ai ? (
        <XStack
          paddingHorizontal={12}
          paddingVertical={7}
          borderRadius={999}
          backgroundColor={ui.brand}
          cursor="pointer"
          alignItems="center"
          gap={6}
          pressStyle={{ opacity: 0.9 }}
          onPress={() =>
            ai.openAssist({
              product: aiProduct ?? (product as AiProduct),
              contextPage,
            })
          }
        >
          <Icons.Sparkles size={14} color={ui.onBrand} />
          <Text fontSize={12} fontWeight="700" color={ui.onBrand}>
            Ask AI
          </Text>
        </XStack>
      ) : null}
    </XStack>
  )
}
