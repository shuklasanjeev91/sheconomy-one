import { useCallback, useEffect, useState } from 'react'

import { ShareSheet } from '~/components/share'
import { Button, Icons, ScrollView, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { CoWorkPanelShell, CoWorkSectionLabel, CoWorkStatusPill } from '~/co-work/components/CoWorkUi'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import {
  createMeetingRecordingShare,
  downloadMeetingRecordingUrl,
  listMeetingRecordings,
  revokeMeetingRecordingShare,
  type MeetingRecordingSummary,
} from '~/co-work/lib/meeting-recording-client'
import { recordingStatusLabel } from '~/co-work/lib/meeting-recording-status'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { copyShareLink } from '~/lib/share'

type MeetingRecordingsPanelProps = {
  meetingId: string
  meetingTitle: string
  isHost: boolean
  onClose: () => void
  fullWidth?: boolean
}

function formatBytes(bytes?: number | null) {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function statusTone(status: string): 'danger' | 'warning' | 'live' | 'brand' | 'coral' {
  if (status === 'recording' || status === 'starting') return 'danger'
  if (status === 'processing') return 'warning'
  if (status === 'ready') return 'live'
  if (status === 'failed') return 'coral'
  return 'brand'
}

export function MeetingRecordingsPanel({
  meetingId,
  meetingTitle,
  isHost,
  onClose,
  fullWidth,
}: MeetingRecordingsPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<MeetingRecordingSummary[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!isHost) {
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await listMeetingRecordings(meetingId)
    if (!result.ok) {
      toast.show(result.error || 'Could not load recordings', { tone: 'danger' })
      setLoading(false)
      return
    }
    setRecordings(result.recordings ?? [])
    setLoading(false)
  }, [isHost, meetingId, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleShare(recordingId: string) {
    setBusyId(recordingId)
    const result = await createMeetingRecordingShare(recordingId)
    setBusyId(null)
    if (!result.ok || !result.shareUrl) {
      toast.show(result.error || 'Could not create share link', { tone: 'danger' })
      return
    }
    setShareUrl(result.shareUrl)
    setShareOpen(true)
    toast.show(result.rotated ? 'Share link rotated' : 'Share link ready', { tone: 'success' })
    void refresh()
  }

  async function handleCopy(recordingId: string) {
    setBusyId(recordingId)
    const result = await createMeetingRecordingShare(recordingId)
    setBusyId(null)
    if (!result.ok || !result.shareUrl) {
      toast.show(result.error || 'Could not create share link', { tone: 'danger' })
      return
    }
    const copied = await copyShareLink(result.shareUrl)
    toast.show(copied ? 'Recording link copied' : 'Could not copy link', {
      tone: copied ? 'success' : 'danger',
    })
    void refresh()
  }

  async function handleDownload(recordingId: string) {
    setBusyId(recordingId)
    const result = await downloadMeetingRecordingUrl(recordingId)
    setBusyId(null)
    if (!result.ok || !result.downloadUrl) {
      toast.show(result.error || 'Could not prepare download', { tone: 'danger' })
      return
    }
    await openExternalUrl(result.downloadUrl)
  }

  async function handleRevoke(recordingId: string) {
    setBusyId(recordingId)
    const result = await revokeMeetingRecordingShare(recordingId)
    setBusyId(null)
    if (!result.ok) {
      toast.show(result.error || 'Could not revoke link', { tone: 'danger' })
      return
    }
    toast.show('Share link revoked', { tone: 'success' })
    void refresh()
  }

  return (
    <CoWorkPanelShell fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Recordings"
        subtitle="Cloud audio + video for this meeting"
        icon={<Icons.Circle size={18} color={coworkUi.brandLight} />}
        onClose={onClose}
      />

      <ScrollView flex={1} padding="$3">
        {!isHost ? (
          <Text color={coworkUi.textSecondary}>Only the host can manage recordings.</Text>
        ) : loading ? (
          <YStack alignItems="center" justifyContent="center" padding="$6" gap="$3">
            <Spinner size="small" color={coworkUi.brandLight} />
            <Text color={coworkUi.textMuted}>Loading recordings…</Text>
          </YStack>
        ) : recordings.length === 0 ? (
          <YStack
            gap="$2"
            padding="$4"
            borderRadius={14}
            backgroundColor={coworkUi.surfaceMuted}
            borderWidth={1}
            borderColor={coworkUi.borderSoft}
          >
            <Text fontSize={14} fontWeight="700" color={coworkUi.text}>
              No recordings yet
            </Text>
            <Text fontSize={12} color={coworkUi.textMuted} lineHeight={18}>
              Tap Record in the meeting controls to capture the full room (audio + video), then share
              a revocable link when processing finishes.
            </Text>
          </YStack>
        ) : (
          <YStack gap="$3">
            <CoWorkSectionLabel>Host library</CoWorkSectionLabel>
            {recordings.map((recording) => {
              const busy = busyId === recording.id
              const ready = recording.status === 'ready'
              const meta = [
                formatDuration(recording.durationSeconds),
                formatBytes(recording.fileSizeBytes),
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <YStack
                  key={recording.id}
                  gap="$3"
                  padding="$3"
                  borderRadius={14}
                  backgroundColor={coworkUi.surfaceMuted}
                  borderWidth={1}
                  borderColor={coworkUi.borderSoft}
                >
                  <XStack alignItems="center" justifyContent="space-between" gap="$2">
                    <YStack flex={1} gap={4}>
                      <Text fontSize={14} fontWeight="800" color={coworkUi.text}>
                        {meetingTitle}
                      </Text>
                      <Text fontSize={11} color={coworkUi.textMuted}>
                        {recording.createdAt
                          ? new Date(recording.createdAt).toLocaleString()
                          : 'Just now'}
                        {meta ? ` · ${meta}` : ''}
                      </Text>
                    </YStack>
                    <CoWorkStatusPill
                      label={recordingStatusLabel(recording.status)}
                      tone={statusTone(String(recording.status))}
                    />
                  </XStack>

                  {recording.errorMessage ? (
                    <Text fontSize={12} color={coworkUi.danger} lineHeight={18}>
                      {recording.errorMessage}
                    </Text>
                  ) : null}

                  {ready ? (
                    <XStack gap="$2" flexWrap="wrap">
                      <Button
                        tone="primary"
                        size="$2"
                        borderRadius={999}
                        disabled={busy}
                        icon={<Icons.Share2 size={14} color="white" />}
                        onPress={() => void handleShare(recording.id)}
                      >
                        Share
                      </Button>
                      <Button
                        tone="outline"
                        size="$2"
                        borderRadius={999}
                        disabled={busy}
                        borderColor={coworkUi.borderAccent}
                        color={coworkUi.brandLight}
                        icon={<Icons.Copy size={14} color={coworkUi.brandLight} />}
                        onPress={() => void handleCopy(recording.id)}
                      >
                        Copy link
                      </Button>
                      <Button
                        tone="outline"
                        size="$2"
                        borderRadius={999}
                        disabled={busy}
                        borderColor={coworkUi.borderAccent}
                        color={coworkUi.brandLight}
                        icon={<Icons.Download size={14} color={coworkUi.brandLight} />}
                        onPress={() => void handleDownload(recording.id)}
                      >
                        Download
                      </Button>
                      {recording.hasShareLink ? (
                        <Button
                          tone="ghost"
                          size="$2"
                          borderRadius={999}
                          disabled={busy}
                          color={coworkUi.danger}
                          onPress={() => void handleRevoke(recording.id)}
                        >
                          Revoke
                        </Button>
                      ) : null}
                    </XStack>
                  ) : recording.status === 'processing' ||
                    recording.status === 'recording' ||
                    recording.status === 'starting' ? (
                    <Text fontSize={12} color={coworkUi.textMuted}>
                      {recording.status === 'processing'
                        ? 'Processing your MP4. A shareable link will appear when ready.'
                        : 'Cloud recording in progress…'}
                    </Text>
                  ) : null}
                </YStack>
              )
            })}
          </YStack>
        )}
      </ScrollView>

      <YStack padding="$3" borderTopWidth={1} borderTopColor={coworkUi.borderSoft}>
        <Button
          tone="outline"
          borderRadius={999}
          borderColor={coworkUi.borderAccent}
          color={coworkUi.brandLight}
          icon={<Icons.RefreshCw size={16} color={coworkUi.brandLight} />}
          onPress={() => void refresh()}
        >
          Refresh
        </Button>
      </YStack>

      <ShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Share recording"
        copyLabel="Copy recording link"
        copyToastMessage="Recording link copied to clipboard."
        payload={{
          url: shareUrl ?? '',
          title: `${meetingTitle} recording`,
        }}
      />
    </CoWorkPanelShell>
  )
}
