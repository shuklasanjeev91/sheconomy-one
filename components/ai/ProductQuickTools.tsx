import { useRouter } from 'one'

import { Icons, Text, XStack, YStack } from '~/components/ui'
import { HorizontalScrollRow } from '~/components/layout'
import { radius } from '~/config/tokens'
import { aiProductLabel, type AiProduct } from '~/lib/ai'
import { productQuickTools } from '~/lib/ai/product-quick-tools'
import { useAppUi } from '~/lib/theme/useAppUi'
import { useAiAssistOptional } from '~/providers/AiAssistProvider'
import { useSupabase } from '~/providers/SupabaseProvider'

type ProductQuickToolsProps = {
  product: AiProduct
  contextPage?: string
  title?: string
  /** Optional page padding for mobile full-bleed screens. */
  inset?: boolean
}

/**
 * Cross-platform quick actions for each primary tab (web + iOS + Android).
 * Combines deep links and AI assist prompts in one rail.
 */
export function ProductQuickTools({
  product,
  contextPage = 'home',
  title = 'Quick tools',
  inset = false,
}: ProductQuickToolsProps) {
  const ui = useAppUi()
  const router = useRouter()
  const { user } = useSupabase()
  const ai = useAiAssistOptional()
  const tools = productQuickTools(product)

  if (!user || tools.length === 0) return null

  function onTool(tool: (typeof tools)[number]) {
    // Prefer AI when a prompt exists; navigate alone when it's a pure deep link.
    if (tool.prompt && ai) {
      ai.openAssist({
        product,
        contextPage,
        prompt: tool.prompt,
        autoSend: tool.autoSend !== false,
      })
      return
    }
    if (tool.href) {
      router.push(tool.href as never)
    }
  }

  const body = (
    <YStack gap="$2" width="100%">
      <XStack alignItems="center" gap="$2">
        <Icons.Sparkles size={15} color={ui.brand} />
        <Text fontSize={14} fontWeight="700" color={ui.text}>
          {title}
        </Text>
        <Text fontSize={12} color={ui.textMuted}>
          {aiProductLabel(product)}
        </Text>
      </XStack>

      <HorizontalScrollRow gap="$2">
        {tools.map((tool) => (
          <YStack
            key={tool.id}
            minWidth={148}
            maxWidth={180}
            paddingHorizontal="$3"
            paddingVertical="$3"
            gap="$1"
            borderRadius={radius.card}
            borderWidth={1}
            borderColor={ui.borderSubtle}
            backgroundColor={ui.surface}
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.surfaceHover, borderColor: ui.brand }}
            pressStyle={{ opacity: 0.9, scale: 0.98 }}
            onPress={() => onTool(tool)}
          >
            <XStack alignItems="center" gap="$1.5">
              {tool.prompt ? <Icons.Sparkles size={12} color={ui.brand} /> : <Icons.ArrowUpRight size={12} color={ui.brand} />}
              <Text fontSize={13} fontWeight="700" color={ui.text} numberOfLines={1}>
                {tool.label}
              </Text>
            </XStack>
            <Text fontSize={11} color={ui.textMuted} numberOfLines={2} lineHeight={15}>
              {tool.description}
            </Text>
          </YStack>
        ))}
      </HorizontalScrollRow>
    </YStack>
  )

  if (inset) {
    return (
      <YStack width="100%" paddingHorizontal="$4" paddingVertical="$1">
        {body}
      </YStack>
    )
  }

  return body
}
