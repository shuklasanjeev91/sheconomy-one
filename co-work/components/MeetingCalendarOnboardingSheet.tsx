import { useEffect, useState } from 'react'
import { Modal, Pressable } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
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

/**
 * Zoom-mobile calendar onboarding — Sheconomy magenta CTAs, no Zoom blue.
 */
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

  if (!open) return null

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <YStack
            backgroundColor={ui.surfaceElevated}
            borderTopLeftRadius={20}
            borderTopRightRadius={20}
            paddingHorizontal="$5"
            paddingTop="$5"
            paddingBottom="$6"
            gap="$4"
            borderWidth={1}
            borderColor={ui.borderSoft}
          >
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
              <Text color={ui.text} fontSize={22} fontWeight="800" textAlign="center" letterSpacing={-0.3}>
                {copy.title}
              </Text>
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
                      backgroundColor: active ? ui.brandMuted : ui.surface,
                    }}
                  >
                    <YStack
                      width={36}
                      height={36}
                      borderRadius={10}
                      alignItems="center"
                      justifyContent="center"
                      backgroundColor="rgba(255,255,255,0.06)"
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

            <YStack gap="$2.5">
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

            <XStack alignItems="center" justifyContent="center" gap="$1.5">
              <YStack width={7} height={7} borderRadius={999} backgroundColor={ui.brand} />
              <YStack width={7} height={7} borderRadius={999} backgroundColor={ui.border} />
              <YStack width={7} height={7} borderRadius={999} backgroundColor={ui.border} />
            </XStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
