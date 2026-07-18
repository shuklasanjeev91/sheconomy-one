import { useState } from 'react'

import { CommunityAdaptiveSheet } from '~/community/components/CommunityAdaptiveSheet'
import { localCommentSuggestions } from '~/community/lib/comment-suggestions'
import { addPostComment } from '~/community/lib/post-engagement'
import type { CommunityPost } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import { Button, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { useSupabase } from '~/providers/SupabaseProvider'

type CongratulateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: CommunityPost
  onCongratulated?: () => void
}

/**
 * LinkedIn-style congratulate sheet — preset messages + optional personal note → comment.
 */
export function CongratulateSheet({
  open,
  onOpenChange,
  post,
  onCongratulated,
}: CongratulateSheetProps) {
  const communityUi = useCommunityUi()
  const toast = useAppToast()
  const { user } = useSupabase()
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const presets = localCommentSuggestions({
    postType: 'celebration',
    authorName: post.author?.full_name,
    celebrationTitle: post.celebration?.title ?? post.article_title,
  })

  async function send(message: string) {
    if (!user) {
      toast.show('Sign in to congratulate', { tone: 'danger' })
      return
    }
    const content = message.trim()
    if (!content) return

    setSending(true)
    const { error } = await addPostComment(user.id, post.id, content)
    setSending(false)

    if (error) {
      toast.show('Could not send', { tone: 'danger', message: error })
      return
    }

    toast.show('Congratulation sent', { tone: 'success' })
    setNote('')
    onOpenChange(false)
    onCongratulated?.()
  }

  return (
    <CommunityAdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Congratulate"
      tall
    >
      <YStack gap={14} paddingBottom={8}>
        <Text fontSize={14} color={communityUi.textMuted} lineHeight={20}>
          Celebrate with {post.author?.full_name?.split(/\s+/)[0] || 'them'} — pick a message or write
          your own.
        </Text>

        <YStack gap={8}>
          {presets.map((preset) => (
            <XStack
              key={preset}
              paddingVertical={12}
              paddingHorizontal={14}
              borderRadius={12}
              borderWidth={1}
              borderColor={communityUi.border}
              backgroundColor={communityUi.cardBg}
              cursor="pointer"
              hoverStyle={{ borderColor: communityUi.brand, backgroundColor: communityUi.accentMuted }}
              pressStyle={{ opacity: 0.88 }}
              onPress={() => {
                void send(preset)
              }}
              opacity={sending ? 0.7 : 1}
            >
              <Text fontSize={14} color={communityUi.text} lineHeight={20}>
                {preset}
              </Text>
            </XStack>
          ))}
        </YStack>

        <YStack gap={8}>
          <Text fontSize={13} fontWeight="700" color={communityUi.text}>
            Or write a personal note
          </Text>
          <Input
            value={note}
            onChangeText={setNote}
            placeholder="Add a warm message…"
            multiline
            minHeight={88}
          />
          <Button
            tone="primary"
            borderRadius={999}
            disabled={sending || !note.trim()}
            icon={sending ? <Spinner size="small" color="white" /> : undefined}
            onPress={() => {
              void send(note)
            }}
          >
            {sending ? 'Sending…' : 'Send congratulations'}
          </Button>
        </YStack>
      </YStack>
    </CommunityAdaptiveSheet>
  )
}
