import { useState } from 'react'

import {
  localPostComposeSuggestions,
  type ComposeModeHint,
  type PostComposeChip,
} from '~/community/lib/post-compose-suggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { draftPostWithAi } from '~/lib/ai'
import { useAiAssistOptional } from '~/providers/AiAssistProvider'

type PostComposeAiBarProps = {
  mode: ComposeModeHint
  onApplyDraft: (draft: { content: string; articleTitle?: string }) => void
  /** Current composer text used as AI seed when drafting. */
  seedPrompt?: string
}

/**
 * Cross-platform compose helpers: instant chips + optional AI draft.
 * Works on web, iOS, and Android without platform-specific APIs.
 */
export function PostComposeAiBar({ mode, onApplyDraft, seedPrompt }: PostComposeAiBarProps) {
  const communityUi = useCommunityUi()
  const toast = useAppToast()
  const ai = useAiAssistOptional()
  const [loading, setLoading] = useState(false)
  const chips = localPostComposeSuggestions(mode)

  function applyChip(chip: PostComposeChip) {
    onApplyDraft({ content: chip.draft, articleTitle: chip.articleTitle })
  }

  async function draftWithAi() {
    const prompt =
      seedPrompt?.trim() ||
      (mode === 'article'
        ? 'Draft a short professional article intro about growth and community'
        : mode === 'celebration'
          ? 'Draft a warm professional celebration post'
          : 'Draft a professional update for my network')

    setLoading(true)
    try {
      const result = await draftPostWithAi({ prompt, mode })
      onApplyDraft({
        content: result.content,
        articleTitle: result.title ?? undefined,
      })
      if (result.usedFallback) {
        toast.show('Draft ready', {
          tone: 'info',
          message: 'Used a local draft — AI model may be limited right now.',
        })
      }
    } catch {
      // Open assist as a second path when the dedicated action fails.
      if (ai) {
        ai.openAssist({
          product: 'community',
          contextPage: 'compose',
          prompt: `Help me write a ${mode} post: ${prompt}`,
          autoSend: true,
        })
      } else {
        toast.show('Could not draft', { tone: 'danger' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <YStack gap={8} width="100%">
      <XStack alignItems="center" justifyContent="space-between" gap={8}>
        <XStack alignItems="center" gap={6}>
          <Icons.Sparkles size={14} color={communityUi.brand} />
          <Text fontSize={12} fontWeight="700" color={communityUi.textMuted}>
            Write with AI
          </Text>
        </XStack>
        <XStack
          alignItems="center"
          gap={6}
          paddingHorizontal={10}
          paddingVertical={5}
          borderRadius={999}
          borderWidth={1}
          borderColor={communityUi.border}
          cursor="pointer"
          opacity={loading ? 0.7 : 1}
          hoverStyle={{ backgroundColor: communityUi.hoverBg }}
          pressStyle={{ opacity: 0.85 }}
          onPress={() => {
            if (!loading) void draftWithAi()
          }}
        >
          {loading ? (
            <Spinner size="small" color={communityUi.brand} />
          ) : (
            <Icons.Sparkles size={13} color={communityUi.brand} />
          )}
          <Text fontSize={12} fontWeight="700" color={communityUi.brand}>
            Draft for me
          </Text>
        </XStack>
      </XStack>

      <HorizontalScrollRow gap={8}>
        {chips.map((chip) => (
          <XStack
            key={chip.id}
            paddingHorizontal={12}
            paddingVertical={8}
            borderRadius={999}
            borderWidth={1}
            borderColor={communityUi.border}
            backgroundColor={communityUi.cardBg}
            cursor="pointer"
            hoverStyle={{ backgroundColor: communityUi.hoverBg }}
            pressStyle={{ opacity: 0.85 }}
            onPress={() => applyChip(chip)}
          >
            <Text fontSize={12} fontWeight="600" color={communityUi.text} numberOfLines={1}>
              {chip.label}
            </Text>
          </XStack>
        ))}
      </HorizontalScrollRow>
    </YStack>
  )
}
