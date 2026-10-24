import { useEffect, useState } from 'react'

import type { ComposeModeHint } from '~/community/lib/post-compose-suggestions'
import { useCommunityUi } from '~/community/lib/community-theme'
import { fetchPublicProfile } from '~/community/lib/network'
import { searchGifs } from '~/community/lib/giphy'
import { HorizontalScrollRow } from '~/components/layout'
import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { draftPostWithAi, fetchPostSuggestions, type PostSuggestionChip } from '~/lib/ai'
import { useSupabase } from '~/providers/SupabaseProvider'

type PostComposeAiBarProps = {
  mode: ComposeModeHint
  onApplyDraft: (draft: { content: string; articleTitle?: string; gifUrl?: string }) => void
  /** Current composer text used as AI seed when drafting. */
  seedPrompt?: string
}

const GENERATED_MARK = 'I wanted to put this into words for the SHEconomy community.'
const FRESH_TOPIC = 'showing up for each other'

function draftTopic(seed: string | undefined): string {
  const text = (seed ?? '').trim().replace(/\s+/g, ' ')
  const generated =
    !text || text.includes(GENERATED_MARK) || text.toLowerCase().startsWith('sharing a short update')
  if (generated) return FRESH_TOPIC
  const sentence = text.split(/[.!?]/)[0]?.trim() ?? ''
  const topic = sentence.split(/\s+/).filter(Boolean).slice(0, 12).join(' ').replace(/[.\s]+$/, '')
  return topic || FRESH_TOPIC
}

function localComposeDraft(seed: string | undefined, mode: ComposeModeHint): string {
  return completePostDraft(draftTopic(seed), mode)
}

function completePostDraft(topic: string, mode: ComposeModeHint): string {
  const headline = topic.charAt(0).toUpperCase() + topic.slice(1)
  if (mode === 'celebration') {
    return (
      `${headline} is worth celebrating.\n\n` +
      `${GENERATED_MARK} The people who showed up, the work it took, and the moment itself all matter.\n\n` +
      'Thank you to everyone who has been part of it. I hope this encourages someone else to mark their own win.\n\n' +
      'What would you add from your own experience?'
    )
  }
  if (mode === 'event') {
    return (
      `${headline} is coming up.\n\n` +
      `${GENERATED_MARK} There will be room to ask questions, share what you are building, and leave with one practical next step.\n\n` +
      'If this is useful to you, I would love to see you there.\n\n' +
      'What would you add from your own experience?'
    )
  }
  if (mode === 'poll') {
    return (
      `A question for my network about ${topic}.\n\n` +
      `${GENERATED_MARK} I am curious what has actually worked for you, not just what sounds good in theory.\n\n` +
      'A short reply is welcome. Your answer may help someone who is deciding the same thing.\n\n' +
      'What would you add from your own experience?'
    )
  }
  if (mode === 'article') {
    return (
      `${headline}.\n\n` +
      `${GENERATED_MARK} The lesson was slower than I expected, and it asked me to keep going after the first easy win.\n\n` +
      'Here is what I would tell someone starting today: begin with one honest step, then share what you learn.\n\n' +
      'What would you add from your own experience?'
    )
  }
  return (
    `${headline}.\n\n` +
    `${GENERATED_MARK} It has taken patience, support, and a willingness to keep going when the path was unclear.\n\n` +
    'If you have been through something similar, I would love to hear what helped you. Your experience might be exactly what someone else needs.\n\n' +
    'What would you add from your own experience?'
  )
}

export function PostComposeAiBar({ mode, onApplyDraft, seedPrompt }: PostComposeAiBarProps) {
  const communityUi = useCommunityUi()
  const { user } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [chips, setChips] = useState<PostSuggestionChip[]>([])
  const [loadingChips, setLoadingChips] = useState(true)

  useEffect(() => {
    let cancelled = false
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
        const rows = await fetchPostSuggestions({ mode, memberName, headline, location })
        if (!cancelled) setChips(rows)
      } catch {
        if (!cancelled) setChips([])
      } finally {
        if (!cancelled) setLoadingChips(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, user?.id])

  function applyChip(chip: PostSuggestionChip) {
    onApplyDraft({ content: chip.draft })
  }

  async function draftWithAi() {
    const prompt =
      seedPrompt?.trim() ||
      (mode === 'article'
        ? 'growth and community'
        : mode === 'celebration'
          ? 'a milestone with this community'
          : mode === 'event'
            ? 'an upcoming conversation'
            : mode === 'poll'
              ? 'a question for my network'
              : 'my network')

    setLoading(true)
    const topic = draftTopic(seedPrompt)
    const local = localComposeDraft(seedPrompt, mode)
    let gifUrl: string | undefined
    try {
      const gifs = await searchGifs(topic, 1)
      gifUrl = gifs[0]?.url
    } catch {
      gifUrl = undefined
    }
    try {
      const result = await draftPostWithAi({ prompt, mode })
      const returned = result.content.trim()
      const sameAsBox = returned === (seedPrompt?.trim() ?? '')
      const templateLine = returned.toLowerCase().startsWith('sharing a short update')
      const content = !returned || sameAsBox || templateLine ? local : returned
      onApplyDraft({
        content,
        articleTitle: result.title ?? undefined,
        gifUrl,
      })
    } catch {
      onApplyDraft({ content: local, gifUrl })
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
