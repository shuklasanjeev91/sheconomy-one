import { Button, Icons } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingCalendarIconButtonProps = {
  onPress: () => void
  disabled?: boolean
}

/** Circular calendar control — tap saves the meeting to the device default calendar. */
export function MeetingCalendarIconButton({ onPress, disabled }: MeetingCalendarIconButtonProps) {
  const { ui: coworkUi } = useCoWorkTheme()

  return (
    <Button
      tone="outline"
      circular
      size="$3"
      width={44}
      height={44}
      padding={0}
      disabled={disabled}
      borderColor={coworkUi.glassBorder}
      backgroundColor={coworkUi.meetingControl}
      pressStyle={{ opacity: 0.8, scale: 0.96, backgroundColor: coworkUi.meetingControl }}
      onPress={onPress}
      aria-label="Add to calendar"
      accessibilityLabel="Add to calendar"
      icon={<Icons.CalendarPlus size={18} color={coworkUi.text} />}
    />
  )
}
