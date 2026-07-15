/**
 * Instant chat reply starters — works offline on web, iOS, and Android.
 */

export function localChatQuickReplies(options?: {
  isReply?: boolean
  peerName?: string | null
}): string[] {
  const name = options?.peerName?.trim().split(/\s+/)[0]
  if (options?.isReply) {
    return [
      'Got it — thanks for the update!',
      'Makes sense. Happy to help with next steps.',
      name ? `Appreciate you flagging this, ${name}.` : 'Appreciate you flagging this.',
      'Can we sync briefly later today?',
    ]
  }
  return [
    name ? `Hi ${name} — hope you’re doing well!` : 'Hi! Hope you’re doing well.',
    'Quick question when you have a moment.',
    'Would love to connect and exchange notes.',
    'Thanks for connecting — looking forward to chatting.',
  ]
}
