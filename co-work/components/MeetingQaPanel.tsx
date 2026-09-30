import { useState } from 'react'

import {
  Button,
  Checkbox,
  Field,
  Icons,
  Input,
  ScrollView,
  Spinner,
  Text,
  XStack,
  YStack,
  useAppToast,
} from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { useMeetingQa } from '~/co-work/hooks/useMeetingQa'
import type { MeetingQuestion } from '~/co-work/lib/meeting-qna'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingQaPanelProps = {
  meetingId: string
  userId: string
  canModerate: boolean
  onClose: () => void
  fullWidth?: boolean
}

function questionStatusLabel(status: MeetingQuestion['status']) {
  switch (status) {
    case 'open':
      return 'Open'
    case 'answered':
      return 'Answered'
    case 'dismissed':
      return 'Dismissed'
    default:
      return status
  }
}

function QuestionRow({
  question,
  canModerate,
  onUpvote,
  onAnswer,
  onDismiss,
  onTogglePin,
  busy,
}: {
  question: MeetingQuestion
  canModerate: boolean
  onUpvote: () => void
  onAnswer: () => void
  onDismiss: () => void
  onTogglePin: () => void
  busy: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const tone =
    question.status === 'answered' ? 'brand' : question.status === 'dismissed' ? 'warning' : 'live'

  return (
    <YStack
      gap="$2.5"
      padding="$3"
      borderRadius={14}
      borderWidth={1}
      borderColor={question.pinned ? coworkUi.borderAccent : coworkUi.borderSoft}
      backgroundColor={coworkUi.surfaceMuted}
    >
      <XStack alignItems="flex-start" gap="$2">
        {question.pinned ? <Icons.Pin size={16} color={coworkUi.brandLight} /> : null}
        <YStack flex={1} gap="$1">
          <Text fontSize={15} fontWeight="600" color={coworkUi.text} lineHeight={22}>
            {question.body}
          </Text>
          <Text fontSize={12} color={coworkUi.textMuted}>
            {question.anonymous
              ? 'Anonymous'
              : question.askerName ?? 'Participant'}
          </Text>
        </YStack>
        <CoWorkStatusPill label={questionStatusLabel(question.status)} tone={tone} />
      </XStack>

      <XStack gap="$2" flexWrap="wrap" alignItems="center">
        <Button
          tone="outline"
          size="$2"
          borderRadius={12}
          disabled={busy || question.iUpvoted}
          icon={<Icons.ThumbsUp size={14} color={coworkUi.text} />}
          onPress={onUpvote}
        >
          {question.upvote_count}
        </Button>

        {canModerate && question.status === 'open' ? (
          <>
            <Button tone="primary" size="$2" borderRadius={12} disabled={busy} onPress={onAnswer}>
              Answer
            </Button>
            <Button tone="outline" size="$2" borderRadius={12} disabled={busy} onPress={onDismiss}>
              Dismiss
            </Button>
            <Button tone="outline" size="$2" borderRadius={12} disabled={busy} onPress={onTogglePin}>
              {question.pinned ? 'Unpin' : 'Pin'}
            </Button>
          </>
        ) : null}
      </XStack>
    </YStack>
  )
}

export function MeetingQaPanel({
  meetingId,
  userId,
  canModerate,
  onClose,
  fullWidth,
}: MeetingQaPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const { questions, loading, refresh, askQuestion, upvote, setQuestionStatus, setPinned } =
    useMeetingQa({ meetingId, userId })
  const [draft, setDraft] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)

  const openCount = questions.filter((q) => q.status === 'open').length

  async function handleAsk() {
    setSubmitting(true)
    try {
      await askQuestion(draft, anonymous)
      setDraft('')
      toast.show('Question submitted', { tone: 'success' })
    } catch (err) {
      toast.show('Could not submit question', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function runAction(questionId: string, fn: () => Promise<void>) {
    setActionId(questionId)
    try {
      await fn()
    } catch (err) {
      toast.show('Action failed', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setActionId(null)
    }
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Q&A"
        subtitle={openCount ? `${openCount} open` : undefined}
        icon={<Icons.HelpCircle size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        <YStack gap="$4">
          <YStack
            gap="$3"
            padding="$3"
            borderRadius={14}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
            backgroundColor={coworkUi.surfaceMuted}
          >
            <CoWorkSectionLabel>Ask a question</CoWorkSectionLabel>
            <Field label="Your question">
              <Input
                value={draft}
                onChangeText={setDraft}
                placeholder="Type your question for the host…"
                backgroundColor={coworkUi.surface}
                borderColor={coworkUi.borderSoft}
                color={coworkUi.text}
                borderRadius={14}
                multiline
              />
            </Field>
            <XStack alignItems="center" gap="$3">
              <Checkbox
                checked={anonymous}
                onCheckedChange={(checked) => setAnonymous(checked === true)}
                aria-label="Ask anonymously"
              />
              <Text
                fontSize={13}
                color={coworkUi.textSecondary}
                onPress={() => setAnonymous((v) => !v)}
              >
                Ask anonymously
              </Text>
            </XStack>
            <Button
              tone="primary"
              borderRadius={999}
              alignSelf="flex-start"
              disabled={submitting || !draft.trim()}
              icon={submitting ? <Spinner size="small" color="white" /> : undefined}
              onPress={() => void handleAsk()}
            >
              {submitting ? 'Sending…' : 'Submit question'}
            </Button>
          </YStack>

          <XStack gap="$2">
            <Button
              tone="outline"
              size="$2"
              borderRadius={12}
              icon={<Icons.RefreshCw size={14} color={coworkUi.text} />}
              disabled={loading}
              onPress={() => void refresh()}
            >
              Refresh
            </Button>
          </XStack>

          {loading && questions.length === 0 ? (
            <XStack justifyContent="center" paddingVertical="$6">
              <Spinner size="small" color={coworkUi.brandLight} />
            </XStack>
          ) : null}

          {!loading && questions.length === 0 ? (
            <Text fontSize={14} color={coworkUi.textMuted} textAlign="center" paddingVertical="$4">
              No questions yet. Be the first to ask.
            </Text>
          ) : null}

          {questions.map((question) => (
            <QuestionRow
              key={question.id}
              question={question}
              canModerate={canModerate}
              busy={actionId === question.id}
              onUpvote={() =>
                void runAction(question.id, () => upvote(question.id))
              }
              onAnswer={() =>
                void runAction(question.id, () => setQuestionStatus(question.id, 'answered'))
              }
              onDismiss={() =>
                void runAction(question.id, () => setQuestionStatus(question.id, 'dismissed'))
              }
              onTogglePin={() =>
                void runAction(question.id, () => setPinned(question.id, !question.pinned))
              }
            />
          ))}
        </YStack>
      </ScrollView>
    </CoWorkPanelShell>
  )
}
