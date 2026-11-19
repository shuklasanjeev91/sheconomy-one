import { useEffect, useState } from 'react'

import {
  buildPostDraftPrompt,
  filterPostSuggestionChips,
  fallbackPostDraft,
  isThinOrEchoPostDraft,
  localPostComposeSuggestions,
  type ComposeModeHint,
} from '~/community/lib/post-compose-suggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { fetchPublicProfile } from '~/community/lib/network'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
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
  const toast = useAppToast()
  const { user } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [chips, setChips] = useState<PostSuggestionChip[]>([])
  const [loadingChips, setLoadingChips] = useState(true)

  const linkUrl = link?.url ?? ''
  const linkTitle = link?.title ?? ''
  const canDraft =
    Boolean(seedPrompt?.trim()) || photoCount > 0 || videoCount > 0 || Boolean(linkUrl)

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
          // Pass a short topic hint — full composer text makes SHERPA echo the seed as a chip.
          const topicHint = seedPrompt?.trim().slice(0, 160) || ''
          const rows = await fetchPostSuggestions({
            mode,
            memberName,
            headline,
            location,
            prompt: topicHint,
            photoCount,
            videoCount,
            link: linkUrl ? { url: linkUrl, title: linkTitle } : null,
          })
          if (cancelled) return
          const filtered = filterPostSuggestionChips(rows, seedPrompt)
          if (filtered.length > 0) {
            setChips(filtered)
            return
          }
          setChips(
            localPostComposeSuggestions(mode).map((row) => ({
              label: row.label,
              draft: row.draft,
            })),
          )
        } catch {
          if (!cancelled) {
            setChips(
              localPostComposeSuggestions(mode).map((row) => ({
                label: row.label,
                draft: row.draft,
              })),
            )
          }
        } finally {
          if (!cancelled) setLoadingChips(false)
        }
      })()
    }, 450)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [mode, user?.id, seedPrompt, photoCount, videoCount, linkUrl, linkTitle])

  async function generateDraft(seed?: string) {
    const promptSeed = (seed ?? seedPrompt)?.trim() ?? ''
    if (!promptSeed && photoCount < 1 && videoCount < 1 && !link?.url) return

    setLoading(true)
    try {
      const prompt = buildPostDraftPrompt({
        seed: promptSeed,
        photoCount,
        videoCount,
        link,
      })
      const result = await draftPostWithAi({
        prompt,
        mode,
        photoCount,
        videoCount,
        link,
      })
      const returned = result.content.trim()
      if (!returned || isThinOrEchoPostDraft(returned, promptSeed)) {
        const fallback = fallbackPostDraft(promptSeed || link?.title || linkUrl || 'this update', mode)
        onApplyDraft({
          content: fallback.content,
          articleTitle: result.title ?? fallback.title ?? undefined,
        })
        return
      }
      onApplyDraft({
        content: returned,
        articleTitle: result.title ?? undefined,
      })
    } catch {
      const fallback = fallbackPostDraft(promptSeed || link?.title || linkUrl || 'this update', mode)
      onApplyDraft({
        content: fallback.content,
        articleTitle: fallback.title ?? undefined,
      })
      toast.show('Draft ready', {
        tone: 'info',
        message: 'Expanded your notes into a starter post. Edit anything before posting.',
      })
    } finally {
      setLoading(false)
    }
  }

  function applyChip(chip: PostSuggestionChip) {
    // Short / echo chips are instructions — expand them into a full post.
    if (isThinOrEchoPostDraft(chip.draft, seedPrompt) || isThinOrEchoPostDraft(chip.draft, chip.label)) {
      void generateDraft(chip.draft || chip.label || seedPrompt)
      return
    }
    onApplyDraft({ content: chip.draft })
  }

  return (
    <YStack gap={8} width="100%">
      <XStack alignItems="center" gap={8}>
        <XStack
          alignItems="center"
          gap={6}
          cursor={canDraft || loading ? 'pointer' : 'default'}
          opacity={loading ? 0.7 : canDraft ? 1 : 0.45}
          pressStyle={canDraft ? { opacity: 0.85 } : undefined}
          onPress={() => {
            if (!loading && canDraft) void generateDraft()
          }}
          accessibilityRole="button"
          accessibilityLabel="Write with AI"
          accessibilityState={{ disabled: !canDraft || loading }}
        >
          {loading ? (
            <Spinner size="small" color={communityUi.brand} />
          ) : (
            <Icons.Sparkles size={14} color={communityUi.brand} />
          )}
          <Text fontSize={12} fontWeight="700" color={communityUi.brand}>
            {loading ? 'Writing…' : 'Write with AI'}
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
