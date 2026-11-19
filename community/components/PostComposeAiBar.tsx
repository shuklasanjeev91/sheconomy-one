import { useEffect, useState } from 'react'

import {
  buildPostDraftPrompt,
  composeExpansionChips,
  filterPostSuggestionChips,
  isComposeInstruction,
  isGenericFallbackDraft,
  isLeakedComposePrompt,
  isThinOrEchoPostDraft,
  localPostComposeSuggestions,
  type ComposeModeHint,
} from '~/community/lib/post-compose-suggestions'
import {
  deriveGifQueryFromSeed,
  mergeMemberHashtags,
} from '~/community/lib/post-draft-complete'
import { useCommunityUi } from '~/community/lib/community-theme'
import { pickComposeGif } from '~/community/lib/giphy'
import { fetchPublicProfile } from '~/community/lib/network'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { draftPostWithAi, fetchPostSuggestions, type PostSuggestionChip } from '~/lib/ai'
import { useSupabase } from '~/providers/SupabaseProvider'

type ComposeLink = { url: string; title?: string | null; description?: string | null }

export type PostComposeAiDraft = {
  content: string
  articleTitle?: string
  gifUrl?: string
  suggestPhoto?: boolean
  suggestVideo?: boolean
}

type PostComposeAiBarProps = {
  mode: ComposeModeHint
  onApplyDraft: (draft: PostComposeAiDraft) => void
  onPickPhoto?: () => void
  onPickVideo?: () => void
  /** Current composer text used as AI seed when drafting. */
  seedPrompt?: string
  photoCount?: number
  videoCount?: number
  hasGif?: boolean
  link?: ComposeLink | null
}

export function PostComposeAiBar({
  mode,
  onApplyDraft,
  onPickPhoto,
  onPickVideo,
  seedPrompt,
  photoCount = 0,
  videoCount = 0,
  hasGif = false,
  link = null,
}: PostComposeAiBarProps) {
  const communityUi = useCommunityUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [chips, setChips] = useState<PostSuggestionChip[]>([])
  const [loadingChips, setLoadingChips] = useState(true)
  const [mediaHints, setMediaHints] = useState<{ photo: boolean; video: boolean }>({
    photo: false,
    video: false,
  })

  const linkUrl = link?.url ?? ''
  const linkTitle = link?.title ?? ''
  const seed = seedPrompt?.trim() ?? ''
  const instructionMode = isComposeInstruction(seed)
  const canDraft = Boolean(seed) || photoCount > 0 || videoCount > 0 || Boolean(linkUrl)
  const hasMedia = photoCount > 0 || videoCount > 0 || hasGif

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      setLoadingChips(true)
      void (async () => {
        // While the member is still writing an instruction, show expansion actions
        // instead of SHERPA chips that often echo the prompt.
        if (isComposeInstruction(seed)) {
          if (!cancelled) {
            setChips(
              composeExpansionChips(seed).map((row) => ({
                label: row.label,
                draft: row.seed,
              })),
            )
            setLoadingChips(false)
          }
          return
        }

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
            prompt: seed.slice(0, 160),
            photoCount,
            videoCount,
            link: linkUrl ? { url: linkUrl, title: linkTitle } : null,
          })
          if (cancelled) return
          const filtered = filterPostSuggestionChips(rows, seed)
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
  }, [mode, user?.id, seed, photoCount, videoCount, linkUrl, linkTitle])

  function applyGeneratedDraft(
    result: {
      content: string
      title: string | null
      gifQuery?: string | null
      suggestPhoto?: boolean
      suggestVideo?: boolean
    },
    promptSeed: string,
  ) {
    const returned = mergeMemberHashtags(result.content.trim(), promptSeed)
    // draftPostWithAi already rejected thin/template/leak replies — only block clear leaks here.
    const unusable =
      !returned || isLeakedComposePrompt(returned) || isGenericFallbackDraft(returned)

    if (unusable) {
      toast.show('Couldn’t draft this post', {
        tone: 'error',
        message: 'SHERPA couldn’t expand your notes. Tap Write with SHERPA to try again.',
      })
      return
    }

    const suggestPhoto = Boolean(result.suggestPhoto) && photoCount < 1
    const suggestVideo = Boolean(result.suggestVideo) && videoCount < 1
    setMediaHints({ photo: suggestPhoto, video: suggestVideo })

    // Apply text immediately — never wait on Giphy before the caption appears.
    onApplyDraft({
      content: returned,
      articleTitle: result.title ?? undefined,
      suggestPhoto,
      suggestVideo,
    })
    toast.show('Draft ready', {
      tone: 'success',
      message: 'SHERPA wrote a complete post from your notes.',
    })

    if (!hasMedia) {
      const query = (result.gifQuery?.trim() || deriveGifQueryFromSeed(promptSeed)).slice(0, 80)
      void pickComposeGif(query)
        .then((gif) => {
          if (!gif?.url) return
          onApplyDraft({
            content: returned,
            articleTitle: result.title ?? undefined,
            gifUrl: gif.url,
            suggestPhoto,
            suggestVideo,
          })
        })
        .catch(() => {
          // Caption already applied; GIF is optional.
        })
    }
  }

  async function generateDraft(seedOverride?: string) {
    const promptSeed = (seedOverride ?? seed).trim()
    if (!promptSeed && photoCount < 1 && videoCount < 1 && !link?.url) return

    setLoading(true)
    try {
      // Send ONLY the member topic — never the system/instruction block (SHERPA was echoing it).
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
      applyGeneratedDraft(result, promptSeed)
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'SHERPA couldn’t expand your notes. Tap Write with SHERPA to try again.'
      toast.show('Couldn’t draft this post', {
        tone: 'error',
        message,
      })
    } finally {
      setLoading(false)
    }
  }

  function applyChip(chip: PostSuggestionChip) {
    // Instruction chips and thin drafts must expand — never paste the prompt back.
    if (
      instructionMode ||
      isComposeInstruction(chip.draft) ||
      isThinOrEchoPostDraft(chip.draft, seed) ||
      isThinOrEchoPostDraft(chip.draft, chip.label)
    ) {
      void generateDraft(chip.draft || chip.label || seed)
      return
    }
    onApplyDraft({ content: chip.draft })
  }

  const showMediaActions =
    !loading && (mediaHints.photo || mediaHints.video) && (onPickPhoto || onPickVideo)

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
          accessibilityLabel="Write with SHERPA"
          accessibilityState={{ disabled: !canDraft || loading }}
        >
          {loading ? (
            <Spinner size="small" color={communityUi.brand} />
          ) : (
            <Icons.Sparkles size={14} color={communityUi.brand} />
          )}
          <Text fontSize={12} fontWeight="700" color={communityUi.brand}>
            {loading ? 'SHERPA is writing…' : 'Write with SHERPA'}
          </Text>
        </XStack>
      </XStack>

      {loadingChips ? (
        <XStack paddingVertical={4}>
          <Spinner size="small" color={communityUi.brand} />
        </XStack>
      ) : chips.length > 0 || showMediaActions ? (
        <HorizontalScrollRow gap={8}>
          {showMediaActions && mediaHints.photo && onPickPhoto ? (
            <XStack
              key="add-photo"
              paddingHorizontal={12}
              paddingVertical={8}
              borderRadius={999}
              borderWidth={1}
              borderColor={communityUi.brand}
              backgroundColor={communityUi.cardBg}
              cursor="pointer"
              hoverStyle={{ backgroundColor: communityUi.hoverBg }}
              pressStyle={{ opacity: 0.85 }}
              onPress={onPickPhoto}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
            >
              <Text fontSize={12} fontWeight="600" color={communityUi.brand} numberOfLines={1}>
                Add photo
              </Text>
            </XStack>
          ) : null}
          {showMediaActions && mediaHints.video && onPickVideo ? (
            <XStack
              key="add-video"
              paddingHorizontal={12}
              paddingVertical={8}
              borderRadius={999}
              borderWidth={1}
              borderColor={communityUi.brand}
              backgroundColor={communityUi.cardBg}
              cursor="pointer"
              hoverStyle={{ backgroundColor: communityUi.hoverBg }}
              pressStyle={{ opacity: 0.85 }}
              onPress={onPickVideo}
              accessibilityRole="button"
              accessibilityLabel="Add video"
            >
              <Text fontSize={12} fontWeight="600" color={communityUi.brand} numberOfLines={1}>
                Add video
              </Text>
            </XStack>
          ) : null}
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
