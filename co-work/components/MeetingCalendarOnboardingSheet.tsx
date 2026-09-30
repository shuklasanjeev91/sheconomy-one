import { useEffect, useState } from 'react'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { AppBottomSheet, Button, Icons, Text, XStack, YStack } from '~/components/ui'
import {
  calendarOnboardingCopy,
  calendarOnboardingProviderLabel,
  type CalendarOnboardingProvider,
} from '~/co-work/lib/meeting-calendar-onboarding'
import { useCoWorkTheme } from '~/co-work/lib/theme'

type MeetingCalendarOnboardingSheetProps = {
  open: boolean
  onClose: () => void
  onConnect: (provider: CalendarOnboardingProvider) => void | Promise<void>
  busy?: boolean
}

const PROVIDERS: CalendarOnboardingProvider[] = ['google', 'microsoft', 'device']

/** Calendar onboarding bottom sheet. */
export function MeetingCalendarOnboardingSheet({
  open,
  onClose,
  onConnect,
  busy = false,
}: MeetingCalendarOnboardingSheetProps) {
  const { ui } = useCoWorkTheme()
  const copy = calendarOnboardingCopy()
  const [selected, setSelected] = useState<CalendarOnboardingProvider>('google')

  useEffect(() => {
    if (open) setSelected('google')
  }, [open])

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title={copy.title}
      showHandle
      scrollable
      footer={
        <YStack gap="$2.5" width="100%">
          <Button
            tone="primary"
            height={48}
            borderRadius={12}
            backgroundColor={ui.brand}
            disabled={busy}
            opacity={busy ? 0.6 : 1}
            onPress={() => void onConnect(selected)}
          >
            {copy.connect}
          </Button>
          <Button
            tone="ghost"
            height={48}
            borderRadius={12}
            backgroundColor={ui.brandMuted}
            color={ui.brandLight}
            disabled={busy}
            onPress={onClose}
          >
            {copy.notNow}
          </Button>
        </YStack>
      }
    >
      <YStack gap="$4">
        <YStack alignItems="center" gap="$2">
          <YStack
            width={72}
            height={72}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={ui.brandMuted}
            borderWidth={1}
            borderColor={ui.borderAccent}
          >
            <Icons.CalendarDays size={32} color={ui.brandLight} />
          </YStack>
          <Text color={ui.textSecondary} fontSize={14} lineHeight={20} textAlign="center">
            {copy.body}
          </Text>
        </YStack>

        <YStack gap="$2.5">
          {PROVIDERS.map((provider) => {
            const active = selected === provider
            const Icon =
              provider === 'google'
                ? Icons.Mail
                : provider === 'microsoft'
                  ? Icons.Grid
                  : Icons.Calendar
            return (
              <Pressable
                key={provider}
                onPress={() => setSelected(provider)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: active ? ui.brand : ui.borderSoft,
                  backgroundColor: active ? ui.brandMuted : ui.surfaceMuted,
                }}
              >
                <YStack
                  width={36}
                  height={36}
                  borderRadius={10}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={ui.surface}
                >
                  <Icon size={18} color={active ? ui.brandLight : ui.textSecondary} />
                </YStack>
                <Text flex={1} color={ui.text} fontSize={15} fontWeight="700">
                  {calendarOnboardingProviderLabel(provider)}
                </Text>
                <YStack
                  width={22}
                  height={22}
                  borderRadius={999}
                  alignItems="center"
                  justifyContent="center"
                  borderWidth={2}
                  borderColor={active ? ui.brand : ui.border}
                  backgroundColor={active ? ui.brand : 'transparent'}
                >
                  {active ? <Icons.Check size={12} color="#fff" /> : null}
                </YStack>
              </Pressable>
            )
          })}
        </YStack>
      </YStack>
    </AppBottomSheet>
  )
}
