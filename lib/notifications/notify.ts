import { supabase } from '~/lib/supabase/client'

export type NotifyChannels = Array<'in_app' | 'email' | 'push' | 'sms' | 'whatsapp'>

export type NotifyFromTemplateInput = {
  templateKey: string
  recipientId: string
  variables?: Record<string, unknown>
  contextType?: string
  contextId?: string
  /** Force channel set (still filtered by recipient prefs server-side). */
  channels?: NotifyChannels
  priority?: number
  scheduledFor?: string
}

/**
 * Create an in-app notification and enqueue email/push (and other outbound
 * channels) via the shared template + dispatch pipeline.
 * Works for all products; dispatch covers web / iOS / Android push devices.
 */
export async function notifyFromTemplate(
  input: NotifyFromTemplateInput,
): Promise<{ notificationId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_notification_from_template', {
    p_template_key: input.templateKey,
    p_recipient_id: input.recipientId,
    p_variables: input.variables ?? {},
    p_context_type: input.contextType,
    p_context_id: input.contextId,
    p_override_channels: input.channels,
    p_override_priority: input.priority,
    p_scheduled_for: input.scheduledFor,
  })

  if (error) {
    return { notificationId: null, error: error.message }
  }

  return { notificationId: data ?? null, error: null }
}
