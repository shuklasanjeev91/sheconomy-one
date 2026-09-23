import { useEffect, useState } from 'react'
import { Switch as RNSwitch } from 'react-native'

import { AppBottomSheet, Button, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { formatMeetingCode } from '~/co-work/lib/meetings'

type MeetingStartSheetProps = {
  open: boolean
  onClose: () => void
  pmiCode?: string | null
  onStart: (options: { videoOn: boolean; usePmi: boolean; whiteboard?: boolean }) => void
  onStartWhiteboard?: () => void
}

/** Start-a-meeting options as a bottom sheet (web + native). */
export function MeetingStartSheet({
  open,
  onClose,
  pmiCode,
  onStart,
  onStartWhiteboard,
}: MeetingStartSheetProps) {
  const { ui } = useCoWorkTheme()
  const [videoOn, setVideoOn] = useState(true)
  const [usePmi, setUsePmi] = useState(false)

  useEffect(() => {
    if (!open) return
    setVideoOn(true)
    setUsePmi(false)
  }, [open])

  return (
    <AppBottomSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      title="Start a meeting"
      showHandle
      scrollable
      footer={
        <YStack gap="$2.5" width="100%">
          <Button
            tone="primary"
            height={48}
            borderRadius={12}
            backgroundColor={ui.brand}
            onPress={() => {
              onStart({ videoOn, usePmi: usePmi && !!pmiCode })
              onClose()
            }}
          >
            Start a meeting
          </Button>
          {onStartWhiteboard ? (
            <Button
              tone="outline"
              height={48}
              borderRadius={12}
              onPress={() => {
                onStartWhiteboard()
                onClose()
              }}
            >
              Start with whiteboard
            </Button>
          ) : null}
        </YStack>
      }
    >
      <YStack gap="$1">
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingVertical="$3"
          borderBottomWidth={1}
          borderBottomColor={ui.borderSoft}
        >
          <Text color={ui.text} fontSize={15} fontWeight="600">
            Video on
          </Text>
          <RNSwitch
            value={videoOn}
            onValueChange={setVideoOn}
            trackColor={{ false: ui.borderSoft, true: ui.brand }}
            thumbColor="#fff"
          />
        </XStack>

        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingVertical="$3"
          gap="$3"
        >
          <YStack flex={1} gap={2}>
            <Text color={ui.text} fontSize={15} fontWeight="600">
              Use personal meeting ID (PMI)
            </Text>
            {pmiCode ? (
              <Text color={ui.textMuted} fontSize={13} fontWeight="600">
                {formatMeetingCode(pmiCode)}
              </Text>
            ) : null}
          </YStack>
          <RNSwitch
            value={usePmi}
            onValueChange={setUsePmi}
            disabled={!pmiCode}
            trackColor={{ false: ui.borderSoft, true: ui.brand }}
            thumbColor="#fff"
          />
        </XStack>
      </YStack>
    </AppBottomSheet>
  )
}
