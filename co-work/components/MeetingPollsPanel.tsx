import { useMemo, useState } from 'react'

import {
  Button,
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
import { useMeetingPolls } from '~/co-work/hooks/useMeetingPolls'
import type { MeetingPoll } from '~/co-work/lib/meeting-polls'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingPollsPanelProps = {
  meetingId: string
  userId: string
  canModerate: boolean
  onClose: () => void
  fullWidth?: boolean
}

function pollStatusLabel(status: MeetingPoll['status']) {
  switch (status) {
    case 'open':
      return 'Open'
    case 'shared':
      return 'Results shared'
    case 'closed':
      return 'Ended'
    default:
      return status
  }
}

function pollStatusTone(status: MeetingPoll['status']): 'live' | 'brand' | 'warning' {
  if (status === 'open') return 'live'
  if (status === 'shared') return 'brand'
  return 'warning'
}

function PollCard({
  poll,
  canModerate,
  onVote,
  onShareResults,
  onEnd,
  busy,
}: {
  poll: MeetingPoll
  canModerate: boolean
  onVote: (optionId: string) => void
  onShareResults: () => void
  onEnd: () => void
  busy: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const showTallies = canModerate || poll.status === 'shared' || poll.status === 'closed'
  const canVote = poll.status === 'open' && !busy
  const totalVotes = useMemo(
    () => poll.options.reduce((sum, option) => sum + option.vote_count, 0),
    [poll.options],
  )

  return (
    <YStack
      gap="$3"
      padding="$3"
      borderRadius={14}
      borderWidth={1}
      borderColor={coworkUi.borderSoft}
      backgroundColor={coworkUi.surfaceMuted}
    >
      <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
        <Text flex={1} fontSize={15} fontWeight="700" color={coworkUi.text} lineHeight={22}>
          {poll.question}
        </Text>
        <CoWorkStatusPill label={pollStatusLabel(poll.status)} tone={pollStatusTone(poll.status)} />
      </XStack>

      <YStack gap="$2">
        {poll.options.map((option) => {
          const selected = poll.myOptionIds.includes(option.id)
          const pct =
            showTallies && totalVotes > 0
              ? Math.round((option.vote_count / totalVotes) * 100)
              : 0
          return (
            <YStack key={option.id} gap="$1">
              <XStack
                alignItems="center"
                gap="$2"
                paddingHorizontal="$3"
                paddingVertical="$2.5"
                borderRadius={12}
                borderWidth={1}
                borderColor={selected ? coworkUi.borderAccent : coworkUi.borderSoft}
                backgroundColor={selected ? coworkUi.brandMuted : 'rgba(255,255,255,0.03)'}
                opacity={canVote || selected ? 1 : 0.85}
                cursor={canVote ? 'pointer' : undefined}
                pressStyle={canVote ? { opacity: 0.85 } : undefined}
                onPress={canVote ? () => onVote(option.id) : undefined}
              >
                {selected ? (
                  <Icons.CheckCircle2 size={18} color={coworkUi.brandLight} />
                ) : (
                  <YStack
                    width={18}
                    height={18}
                    borderRadius={999}
                    borderWidth={1.5}
                    borderColor={coworkUi.textMuted}
                  />
                )}
                <Text flex={1} fontSize={14} color={coworkUi.text}>
                  {option.option_text}
                </Text>
                {showTallies ? (
                  <Text fontSize={13} fontWeight="700" color={coworkUi.textMuted}>
                    {option.vote_count}
                    {totalVotes > 0 ? ` (${pct}%)` : ''}
                  </Text>
                ) : null}
              </XStack>
              {showTallies && totalVotes > 0 ? (
                <YStack
                  height={4}
                  borderRadius={999}
                  backgroundColor="rgba(255,255,255,0.06)"
                  overflow="hidden"
                  marginHorizontal="$1"
                >
                  <YStack
                    height={4}
                    width={`${pct}%`}
                    backgroundColor={coworkUi.brand}
                    borderRadius={999}
                  />
                </YStack>
              ) : null}
            </YStack>
          )
        })}
      </YStack>

      {canModerate && poll.status === 'open' ? (
        <XStack gap="$2" flexWrap="wrap">
          <Button tone="outline" size="$2" borderRadius={12} disabled={busy} onPress={onShareResults}>
            Share results
          </Button>
          <Button tone="outline" size="$2" borderRadius={12} disabled={busy} onPress={onEnd}>
            End poll
          </Button>
        </XStack>
      ) : null}
    </YStack>
  )
}

export function MeetingPollsPanel({
  meetingId,
  userId,
  canModerate,
  onClose,
  fullWidth,
}: MeetingPollsPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const { polls, loading, refresh, createPoll, vote, setStatus } = useMeetingPolls({
    meetingId,
    userId,
  })
  const [showCreate, setShowCreate] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [saving, setSaving] = useState(false)
  const [actionPollId, setActionPollId] = useState<string | null>(null)

  const openPolls = polls.filter((p) => p.status === 'open')

  async function handleCreate() {
    setSaving(true)
    try {
      await createPoll({ question, options })
      setQuestion('')
      setOptions(['', ''])
      setShowCreate(false)
      toast.show('Poll created', { tone: 'success' })
    } catch (err) {
      toast.show('Could not create poll', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleVote(pollId: string, optionId: string) {
    setActionPollId(pollId)
    try {
      await vote(pollId, optionId)
    } catch (err) {
      toast.show('Could not submit vote', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setActionPollId(null)
    }
  }

  async function handleSetStatus(pollId: string, status: 'shared' | 'closed') {
    setActionPollId(pollId)
    try {
      await setStatus(pollId, status)
      toast.show(status === 'shared' ? 'Results shared' : 'Poll ended', { tone: 'success' })
    } catch (err) {
      toast.show('Could not update poll', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setActionPollId(null)
    }
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Polls"
        subtitle={openPolls.length ? `${openPolls.length} open` : undefined}
        icon={<Icons.BarChart2 size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        <YStack gap="$4">
          <XStack gap="$2" flexWrap="wrap" alignItems="center">
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
            {canModerate ? (
              <Button
                tone="primary"
                size="$2"
                borderRadius={12}
                icon={<Icons.Plus size={14} color="white" />}
                onPress={() => setShowCreate((v) => !v)}
              >
                {showCreate ? 'Cancel' : 'New poll'}
              </Button>
            ) : null}
          </XStack>

          {canModerate && showCreate ? (
            <YStack
              gap="$3"
              padding="$3"
              borderRadius={14}
              borderWidth={1}
              borderColor={coworkUi.borderSoft}
              backgroundColor="rgba(255,255,255,0.03)"
            >
              <CoWorkSectionLabel>Create poll</CoWorkSectionLabel>
              <Field label="Question">
                <Input
                  value={question}
                  onChangeText={setQuestion}
                  placeholder="What should we decide?"
                  backgroundColor="rgba(255,255,255,0.05)"
                  borderColor={coworkUi.borderSoft}
                  color={coworkUi.text}
                  borderRadius={14}
                />
              </Field>
              <YStack gap="$2">
                <Text fontSize={11} fontWeight="700" color={coworkUi.meetingIconMuted}>
                  Options (2–6)
                </Text>
                {options.map((value, index) => (
                  <XStack key={index} gap="$2" alignItems="center">
                    <Input
                      flex={1}
                      value={value}
                      onChangeText={(text) => {
                        setOptions((prev) => {
                          const next = [...prev]
                          next[index] = text
                          return next
                        })
                      }}
                      placeholder={`Option ${index + 1}`}
                      backgroundColor="rgba(255,255,255,0.05)"
                      borderColor={coworkUi.borderSoft}
                      color={coworkUi.text}
                      borderRadius={12}
                    />
                    {options.length > 2 ? (
                      <Button
                        tone="ghost"
                        size="$2"
                        padding={0}
                        width={36}
                        height={36}
                        icon={<Icons.X size={16} color={coworkUi.textMuted} />}
                        onPress={() => setOptions((prev) => prev.filter((_, i) => i !== index))}
                      />
                    ) : null}
                  </XStack>
                ))}
                {options.length < 6 ? (
                  <Button
                    tone="outline"
                    size="$2"
                    borderRadius={12}
                    alignSelf="flex-start"
                    icon={<Icons.Plus size={14} />}
                    onPress={() => setOptions((prev) => [...prev, ''])}
                  >
                    Add option
                  </Button>
                ) : null}
              </YStack>
              <Button
                tone="primary"
                borderRadius={999}
                alignSelf="flex-start"
                disabled={saving || !question.trim()}
                icon={saving ? <Spinner size="small" color="white" /> : undefined}
                onPress={() => void handleCreate()}
              >
                {saving ? 'Creating…' : 'Create poll'}
              </Button>
            </YStack>
          ) : null}

          {loading && polls.length === 0 ? (
            <XStack justifyContent="center" paddingVertical="$6">
              <Spinner size="small" color={coworkUi.brandLight} />
            </XStack>
          ) : null}

          {!loading && polls.length === 0 ? (
            <Text fontSize={14} color={coworkUi.textMuted} textAlign="center" paddingVertical="$4">
              No polls yet.{canModerate ? ' Create one for the room.' : ''}
            </Text>
          ) : null}

          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              canModerate={canModerate}
              busy={actionPollId === poll.id}
              onVote={(optionId) => void handleVote(poll.id, optionId)}
              onShareResults={() => void handleSetStatus(poll.id, 'shared')}
              onEnd={() => void handleSetStatus(poll.id, 'closed')}
            />
          ))}
        </YStack>
      </ScrollView>
    </CoWorkPanelShell>
  )
}
