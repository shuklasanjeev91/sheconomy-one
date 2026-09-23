import { Badge } from '~/components/ui'
import type { MeetingRole } from '~/co-work/lib/types'
import { meetingRoleBadgeLabel } from '~/co-work/lib/meeting-role-permissions'

type MeetingRoleBadgeProps = {
  role: MeetingRole | null | undefined
  size?: 'sm' | 'md'
}

/** Visible HOST / CO-HOST pill for people list and room layout. */
export function MeetingRoleBadge({ role, size = 'sm' }: MeetingRoleBadgeProps) {
  const label = meetingRoleBadgeLabel(role)
  if (!label) return null

  return (
    <Badge
      tone={role === 'host' ? 'brand' : 'info'}
      size={size}
      accessibilityLabel={label}
    >
      {label}
    </Badge>
  )
}
