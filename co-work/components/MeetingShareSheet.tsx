import { useEffect, useState } from 'react'

import { ShareSheet } from '~/components/share/ShareSheet'
import { ShareActionRow } from '~/components/share/ShareActionRow'
import { Icons, Separator, Text, useAppToast, YStack } from '~/components/ui'
import {
  buildMeetingInvitationText,
  buildMeetingSharePayload,
} from '~/co-work/lib/meeting-share'
import type { Meeting } from '~/co-work/lib/types'
import {
  addMeetingToDeviceCalendar,
  downloadMeetingCalendarIcs,
  openMeetingCalendarProvider,
} from '~/lib/calendar/device-calendar'
import { copyToClipboard } from '~/lib/platform/clipboard'
import { useAppUi } from '~/lib/theme/useAppUi'

type MeetingShareSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  meeting: Meeting
  /** When true, also save to the default calendar once when the sheet opens. */
  autoAddToCalendar?: boolean
}

/**
 * Zoom-style meeting share sheet: social destinations + calendar (default /
 * Google / Outlook / ICS) + copy invitation.
 */
export function MeetingShareSheet({
  open,
  onOpenChange,
  meeting,
  autoAddToCalendar = false,
}: MeetingShareSheetProps) {
  const toast = useAppToast()
  const ui = useAppUi()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !autoAddToCalendar) return
    let cancelled = false
    void (async () => {
      const result = await addMeetingToDeviceCalendar(meeting)
      if (cancelled || result === 'cancelled' || result === 'failed') return
      toast.show(
        result === 'saved' ? 'Added to your calendar' : 'Calendar opened',
        { tone: 'success' },
      )
    })()
    return () => {
      cancelled = true
    }
    // Only when the sheet first opens with autoAdd enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoAddToCalendar, meeting.id])

  async function runCalendarAction(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } finally {
      setBusy(false)
    }
  }

  async function handleAddToDefaultCalendar() {
    await runCalendarAction(async () => {
      const result = await addMeetingToDeviceCalendar(meeting)
      if (result === 'cancelled') return
      toast.show(
        result === 'saved'
          ? 'Added to your calendar'
          : result === 'opened'
            ? 'Calendar opened'
            : result === 'shared'
              ? 'Calendar file ready'
              : 'Could not add to calendar',
        { tone: result === 'failed' ? 'danger' : 'success' },
      )
      if (result !== 'failed') onOpenChange(false)
    })
  }

  async function handleProvider(provider: 'google' | 'outlook' | 'yahoo') {
    await runCalendarAction(async () => {
      const opened = await openMeetingCalendarProvider(meeting, provider)
      if (!opened) {
        toast.show('Could not open calendar', { tone: 'danger' })
        return
      }
      toast.show(
        provider === 'google'
          ? 'Google Calendar opened'
          : provider === 'outlook'
            ? 'Outlook Calendar opened'
            : 'Yahoo Calendar opened',
        { tone: 'success' },
      )
      onOpenChange(false)
    })
  }

  async function handleDownloadIcs() {
    await runCalendarAction(async () => {
      const result = await downloadMeetingCalendarIcs(meeting)
      toast.show(
        result === 'shared' ? 'Calendar invite (.ics) ready' : 'Could not create calendar file',
        { tone: result === 'shared' ? 'success' : 'danger' },
      )
      if (result === 'shared') onOpenChange(false)
    })
  }

  async function handleCopyInvitation() {
    const copied = await copyToClipboard(buildMeetingInvitationText(meeting))
    toast.show(copied ? 'Invitation copied' : 'Could not copy invitation', {
      tone: copied ? 'success' : 'danger',
      message: copied
        ? 'Paste into WhatsApp, email, Slack, or any chat.'
        : undefined,
    })
    if (copied) onOpenChange(false)
  }

  return (
    <ShareSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Share meeting"
      copyLabel="Copy meeting link"
      copyToastMessage="Meeting link copied."
      payload={buildMeetingSharePayload(meeting)}
      extraActions={
        <YStack gap="$1">
          <Separator marginVertical="$2" />
          <Text fontSize={12} fontWeight="700" color={ui.textMuted} paddingHorizontal="$2">
            CALENDAR
          </Text>
          <ShareActionRow
            icon={Icons.CalendarPlus}
            label="Add to calendar"
            onPress={() => void handleAddToDefaultCalendar()}
          />
          <ShareActionRow
            icon={Icons.Calendar}
            label="Google Calendar"
            onPress={() => void handleProvider('google')}
          />
          <ShareActionRow
            icon={Icons.CalendarDays}
            label="Outlook Calendar"
            onPress={() => void handleProvider('outlook')}
          />
          <ShareActionRow
            icon={Icons.Calendar}
            label="Download .ics (Apple / others)"
            onPress={() => void handleDownloadIcs()}
          />
          <Separator marginVertical="$2" />
          <ShareActionRow
            icon={Icons.Copy}
            label="Copy invitation"
            onPress={() => void handleCopyInvitation()}
          />
        </YStack>
      }
    />
  )
}
