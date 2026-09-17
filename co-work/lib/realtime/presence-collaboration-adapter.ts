import type { MeetingChatAudience } from '~/co-work/lib/meeting-role-permissions'
import type { MeetingChatMessage, MeetingParticipant } from '~/co-work/lib/types'
import type { MeetingCollaborationAdapter } from '~/co-work/lib/realtime/meeting-session'

/**
 * Presence / chat / hand-raise adapter — independent of the SFU media layer.
 * Uses a getter so participant lists stay fresh without re-binding.
 */
export type MeetingPresenceCollaborationSource = {
  participants: MeetingParticipant[]
  handRaised: boolean
  sendChat: (
    text: string,
    audience?: MeetingChatAudience,
    recipientId?: string | null,
  ) => Promise<void>
  toggleHandRaise: () => void
  leave: () => Promise<void>
  retryJoinRequest?: () => Promise<void>
}

export function createPresenceCollaborationAdapter(
  getSource: () => MeetingPresenceCollaborationSource | null,
): MeetingCollaborationAdapter {
  const requireSource = (): MeetingPresenceCollaborationSource => {
    const source = getSource()
    if (!source) throw new Error('Meeting presence is not ready yet.')
    return source
  }

  return {
    getParticipants: () => getSource()?.participants ?? [],
    sendChatMessage: async (message, recipientId) => {
      const source = requireSource()
      const audience: MeetingChatAudience = recipientId ? 'private' : 'everyone'
      await source.sendChat(message, audience, recipientId ?? null)
      return {
        id: `local-${Date.now()}`,
        meeting_id: '',
        sender_id: '',
        message_text: message,
        message_type: 'text',
        created_at: new Date().toISOString(),
        audience,
        recipient_id: recipientId ?? null,
      } satisfies MeetingChatMessage
    },
    raiseHand: () => {
      const source = requireSource()
      if (!source.handRaised) source.toggleHandRaise()
    },
    lowerHand: () => {
      const source = requireSource()
      if (source.handRaised) source.toggleHandRaise()
    },
    joinMeeting: async () => {
      await getSource()?.retryJoinRequest?.()
    },
    leaveMeeting: async () => {
      await requireSource().leave()
    },
  }
}
