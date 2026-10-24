import { useEffect, useState } from 'react'

import type { ComposeModeHint } from '~/community/lib/post-compose-suggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { fetchPublicProfile } from '~/community/lib/network'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { draftPostWithAi, fetchPostSuggestions, type PostSuggestionChip } from '~/lib/ai'
import { useSupabase } from '~/providers/SupabaseProvider'

type ComposeLink = { url: string; title?: string | null; description?: string | null }

type PostComposeAiBarProps = {
  mode: ComposeModeHint
  onApplyDraft: (draft: { content: string; articleTitle?: string }) => void
  /** Current composer text used as AI seed when drafting. */
  seedPrompt?: string
  photoCount?: number
  videoCount?: number
  link?: ComposeLink | null
}

export function PostComposeAiBar({
  mode,
  onApplyDraft,
  seedPrompt,
  photoCount = 0,
  videoCount = 0,
  link = null,
}: PostComposeAiBarProps) {
  const communityUi = useCommunityUi()
  const { user } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [chips, setChips] = useState<PostSuggestionChip[]>([])
  const [loadingChips, setLoadingChips] = useState(true)

  const linkUrl = link?.url ?? ''
  const linkTitle = link?.title ?? ''

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoadingChips(true)
      void (async () => {
        let memberName = ''
        let headline = ''
        let location = ''
        if (user?.id) {
          const profile = await fetchPublicProfile(user.id)
          memberName = profile.data?.full_name?.trim() ?? ''
          headline = profile.data?.headline?.trim() || profile.data?.occupation?.trim() || ''
          location = profile.data?.location?.trim() ?? ''
        }
        try {
          const rows = await fetchPostSuggestions({
            mode,
            memberName,
            headline,
            location,
            prompt: seedPrompt,
            photoCount,
            videoCount,
            link: linkUrl ? { url: linkUrl, title: linkTitle } : null,
          })
          if (!cancelled) setChips(rows)
        } catch {
          if (!cancelled) setChips([])
        } finally {
          if (!cancelled) setLoadingChips(false)
        }
      })()
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mode, user?.id, seedPrompt, photoCount, videoCount, linkUrl, linkTitle])

  function applyChip(chip: PostSuggestionChip) {
    onApplyDraft({ content: chip.draft })
  }

  async function draftWithAi() {
    const prompt = seedPrompt?.trim() ?? ''
    if (!prompt && photoCount < 1 && videoCount < 1 && !link?.url) return
    setLoading(true)
    try {
      const result = await draftPostWithAi({
        prompt,
        mode,
        photoCount,
        videoCount,
        link,
      })
      const returned = result.content.trim()
      if (!returned) return
      onApplyDraft({
        content: returned,
        articleTitle: result.title ?? undefined,
      })
    } catch {
      // Leave the words the member already wrote.
    } finally {
      setLoading(false)
    }
  }

  return (
    <YStack gap={8} width="100%">
      <XStack alignItems="center" gap={8}>
        <XStack
          alignItems="center"
          gap={6}
          cursor="pointer"
          opacity={loading ? 0.7 : 1}
          pressStyle={{ opacity: 0.85 }}
          onPress={() => {
            if (!loading) void draftWithAi()
          }}
          accessibilityRole="button"
          accessibilityLabel="Write with AI"
        >
          {loading ? (
            <Spinner size="small" color={communityUi.brand} />
          ) : (
            <Icons.Sparkles size={14} color={communityUi.brand} />
          )}
          <Text fontSize={12} fontWeight="700" color={communityUi.brand}>
            Write with AI
          </Text>
        </XStack>
      </XStack>

      {loadingChips ? (
        <XStack paddingVertical={4}>
          <Spinner size="small" color={communityUi.brand} />
        </XStack>
      ) : chips.length > 0 ? (
        <HorizontalScrollRow gap={8}>
          {chips.map((chip) => (
            <XStack
              key={chip.label}
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
      ) : null}
    </YStack>
  )
}
