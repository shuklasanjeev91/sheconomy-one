import { useEffect, useState } from 'react'

import { Button, Icons, TextArea, Text, YStack, useAppToast } from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { loadMeetingHostNotes, saveMeetingHostNotes } from '~/co-work/lib/meeting-host-notes'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingHostNotesPanelProps = {
  meetingId: string
  userId: string
  onClose: () => void
  fullWidth?: boolean
}

export function MeetingHostNotesPanel({
  meetingId,
  userId,
  onClose,
  fullWidth,
}: MeetingHostNotesPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const next = await loadMeetingHostNotes(meetingId, userId)
      if (!cancelled) {
        setBody(next)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [meetingId, userId])

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="My Notes"
        subtitle="Private to you on this device"
        icon={<Icons.FileText size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />
      <YStack flex={1} padding="$3" gap="$3" minHeight={0}>
        <CoWorkSectionLabel>Meeting notes</CoWorkSectionLabel>
        <TextArea
          value={body}
          onChangeText={setBody}
          editable={!loading}
          placeholder="Decisions, action items, follow-ups…"
          minHeight={220}
          flex={1}
          backgroundColor="rgba(255,255,255,0.04)"
          borderColor={coworkUi.borderSoft}
          color={coworkUi.text}
          borderRadius={14}
        />
        <Button
          tone="primary"
          borderRadius={12}
          disabled={saving || loading}
          onPress={() => {
            setSaving(true)
            void saveMeetingHostNotes(meetingId, userId, body)
              .then(() => toast.show('Notes saved', { tone: 'success' }))
              .catch((cause) =>
                toast.show('Could not save notes', {
                  tone: 'danger',
                  message: cause instanceof Error ? cause.message : undefined,
                }),
              )
              .finally(() => setSaving(false))
          }}
        >
          {saving ? 'Saving…' : 'Save notes'}
        </Button>
        <Text fontSize={12} color={coworkUi.textMuted}>
          Notes stay on this device and are not shared with other participants.
        </Text>
      </YStack>
    </CoWorkPanelShell>
  )
}
