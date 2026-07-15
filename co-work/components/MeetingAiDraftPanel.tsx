import { useState } from 'react'

import { Button, Field, Icons, Input, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { draftMeetingWithAi } from '~/lib/ai'
import { useCoWorkTheme } from '~/co-work/lib/theme'

export type MeetingAiDraftApply = {
  title: string
  description: string
  scheduledAt: string | null
  maxParticipants: number | null
}

const QUICK_PROMPTS = [
  'Weekly team sync tomorrow at 11am',
  '30-min 1:1 coaching this Friday afternoon',
  'Product launch planning workshop next Monday 3pm',
  'Interview loop for designer role tomorrow morning',
]

type MeetingAiDraftPanelProps = {
  timeZone: string
  onApply: (draft: MeetingAiDraftApply) => void
}

/**
 * Zoom / Google Meet–style natural language meeting creator.
 * Fills title, agenda/description, and suggested time on the schedule form.
 */
export function MeetingAiDraftPanel({ timeZone, onApply }: MeetingAiDraftPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  async function generate(fromPrompt?: string) {
    const text = (fromPrompt ?? prompt).trim()
    if (!text) {
      toast.show('Describe your meeting', {
        tone: 'info',
        message: 'Example: “Weekly design sync tomorrow at 4pm”',
      })
      return
    }

    setLoading(true)
    try {
      const draft = await draftMeetingWithAi({ prompt: text, timeZone })
      if (!draft.title) {
        toast.show('Could not draft meeting', { tone: 'danger' })
        return
      }
      const description = [
        draft.description,
        draft.agenda.length
          ? `Agenda:\n${draft.agenda.map((item, i) => `${i + 1}. ${item}`).join('\n')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n')

      onApply({
        title: draft.title,
        description,
        scheduledAt: draft.scheduledAt,
        maxParticipants: draft.maxParticipants,
      })
      if (fromPrompt) setPrompt(fromPrompt)
      toast.show(draft.usedFallback ? 'Draft ready' : 'AI draft ready', {
        tone: 'success',
        message: 'Review the title, time, and agenda below.',
      })
    } catch (err) {
      toast.show('Could not draft meeting', {
        tone: 'danger',
        message: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <YStack
      gap="$3"
      padding="$4"
      borderRadius={16}
      borderWidth={1}
      borderColor={coworkUi.glassBorder}
      backgroundColor="rgba(255,255,255,0.04)"
    >
      <XStack alignItems="center" gap="$2">
        <Icons.Sparkles size={16} color={coworkUi.brand} />
        <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
          Create with AI
        </Text>
      </XStack>
      <Text fontSize={13} color={coworkUi.textSecondary} lineHeight={20}>
        Describe the meeting like you would in Zoom or Google Calendar — we’ll draft the title, agenda, and time.
      </Text>

      <XStack gap="$2" flexWrap="wrap">
        {QUICK_PROMPTS.map((item) => (
          <Text
            key={item}
            fontSize={11}
            color={coworkUi.text}
            paddingHorizontal="$2.5"
            paddingVertical="$1.5"
            borderRadius={999}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
            cursor="pointer"
            onPress={() => void generate(item)}
            opacity={loading ? 0.5 : 1}
          >
            {item}
          </Text>
        ))}
      </XStack>

      <Field label="What is this meeting about?">
        <Input
          value={prompt}
          onChangeText={setPrompt}
          placeholder="e.g. Investor update Friday 5pm — review Q2 metrics"
          backgroundColor="rgba(255,255,255,0.05)"
          borderColor={coworkUi.borderSoft}
          color={coworkUi.text}
          borderRadius={14}
          multiline
          onSubmitEditing={() => void generate()}
        />
      </Field>

      <Button
        tone="primary"
        borderRadius={999}
        alignSelf="flex-start"
        disabled={loading || !prompt.trim()}
        icon={
          loading ? (
            <Spinner size="small" color="white" />
          ) : (
            <Icons.Sparkles size={16} color="white" />
          )
        }
        onPress={() => void generate()}
      >
        {loading ? 'Drafting…' : 'Generate meeting details'}
      </Button>
    </YStack>
  )
}
