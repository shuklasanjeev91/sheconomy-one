import { useCallback, useEffect, useState } from 'react'

import { Button, Spinner, Text, TextArea, XStack, YStack, useAppToast } from '~/components/ui'
import { formatOrderDate } from '~/lib/orders/order.utils'
import {
  fetchIssueComments,
  postIssueComment,
  selectIssueComments,
  selectIssueCommentsLoading,
  selectIssueCommentsPosting,
} from '~/lib/orders/order-issue.store'
import { useAppDispatch, useAppSelector } from '~/lib/store/hooks'
import type { AppUiTokens } from '~/lib/theme/app-ui'

type OrderIssueCommentsThreadProps = {
  ui: AppUiTokens
  issueId: string
  /** Optional resolution note shown above the thread. */
  resolutionNote?: string | null
  compact?: boolean
}

export function OrderIssueCommentsThread({
  ui,
  issueId,
  resolutionNote,
  compact = false,
}: OrderIssueCommentsThreadProps) {
  const dispatch = useAppDispatch()
  const toast = useAppToast()
  const comments = useAppSelector(selectIssueComments(issueId))
  const loading = useAppSelector(selectIssueCommentsLoading(issueId))
  const posting = useAppSelector(selectIssueCommentsPosting(issueId))
  const [draft, setDraft] = useState('')

  useEffect(() => {
    void dispatch(fetchIssueComments({ issueId }))
  }, [dispatch, issueId])

  const onSend = useCallback(async () => {
    const body = draft.trim()
    if (!body) return
    try {
      await dispatch(postIssueComment({ issueId, body })).unwrap()
      setDraft('')
    } catch (message) {
      toast.show('Could not send reply', { tone: 'danger', message: String(message) })
    }
  }, [dispatch, draft, issueId, toast])

  return (
    <YStack gap={compact ? '$2' : '$3'}>
      <Text fontSize={11} fontWeight="800" color={ui.textMuted} letterSpacing={0.3}>
        CONVERSATION
      </Text>

      {resolutionNote?.trim() ? (
        <YStack
          gap="$1"
          padding="$2.5"
          borderRadius={10}
          backgroundColor={ui.surfaceMuted}
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          <Text fontSize={11} fontWeight="700" color={ui.textMuted}>
            Latest resolution note
          </Text>
          <Text fontSize={12} color={ui.text}>
            {resolutionNote.trim()}
          </Text>
        </YStack>
      ) : null}

      {loading && comments.length === 0 ? (
        <XStack alignItems="center" gap="$2">
          <Spinner size="small" />
          <Text fontSize={12} color={ui.textMuted}>
            Loading replies…
          </Text>
        </XStack>
      ) : null}

      {comments.length === 0 && !loading ? (
        <Text fontSize={12} color={ui.textMuted}>
          No replies yet. Add a message below.
        </Text>
      ) : null}

      {comments.map((comment) => (
        <YStack
          key={comment.id}
          gap={2}
          padding="$2.5"
          borderRadius={10}
          backgroundColor={ui.surface}
          borderWidth={1}
          borderColor={ui.borderSubtle}
        >
          <XStack justifyContent="space-between" gap="$2" flexWrap="wrap">
            <Text fontSize={12} fontWeight="700" color={ui.text}>
              {comment.author?.full_name?.trim() || 'Member'}
            </Text>
            <Text fontSize={11} color={ui.textMuted}>
              {formatOrderDate(comment.created_at, true)}
            </Text>
          </XStack>
          <Text fontSize={13} color={ui.textSecondary}>
            {comment.body}
          </Text>
        </YStack>
      ))}

      <YStack gap="$2">
        <TextArea
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a reply…"
          numberOfLines={compact ? 2 : 3}
        />
        <Button
          tone="primary"
          size="$3"
          borderRadius={999}
          alignSelf="flex-end"
          disabled={posting || !draft.trim()}
          onPress={() => void onSend()}
        >
          {posting ? 'Sending…' : 'Send reply'}
        </Button>
      </YStack>
    </YStack>
  )
}
