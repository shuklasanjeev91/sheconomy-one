import { useEffect, useState } from 'react'
import { Switch as RNSwitch } from 'react-native'

import { AppBottomSheet, Button, Input, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { formatMeetingCode } from '~/co-work/lib/meetings'

type MeetingStartSheetProps = {
  open: boolean
  onClose: () => void
  pmiCode?: string | null
  defaultTitle?: string
  onStart: (options: {
    videoOn: boolean
    usePmi: boolean
    whiteboard?: boolean
    title?: string
  }) => void
  onStartWhiteboard?: () => void
}

/** Start-a-meeting options as a bottom sheet (web + native). */
export function MeetingStartSheet({
  open,
  onClose,
  pmiCode,
  defaultTitle,
  onStart,
  onStartWhiteboard,
}: MeetingStartSheetProps) {
  const { ui } = useCoWorkTheme()
  const [videoOn, setVideoOn] = useState(true)
  const [usePmi, setUsePmi] = useState(false)
  const [title, setTitle] = useState(defaultTitle ?? '')

  useEffect(() => {
    if (!open) return
    setVideoOn(true)
    setUsePmi(false)
    setTitle(defaultTitle ?? '')
  }, [open, defaultTitle])

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
              onStart({
                videoOn,
                usePmi: usePmi && !!pmiCode,
                title: title.trim() || undefined,
              })
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
      <YStack gap="$3">
        <YStack gap="$1.5">
          <Text color={ui.text} fontSize={15} fontWeight="600">
            Meeting title
          </Text>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Weekly standup"
            backgroundColor={ui.surfaceMuted}
            borderColor={ui.borderSoft}
            color={ui.text}
            borderRadius={12}
            height={44}
          />
          <Text fontSize={12} color={ui.textMuted}>
            You can rename this again anytime from Meeting info while you are host.
          </Text>
        </YStack>

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
            aria-label="Video on"
            accessibilityLabel="Video on"
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
              <Text fontSize={12} color={ui.textMuted}>
                {formatMeetingCode(pmiCode)}
              </Text>
            ) : (
              <Text fontSize={12} color={ui.textMuted}>
                Available after you start once with PMI
              </Text>
            )}
          </YStack>
          <RNSwitch
            aria-label="Use personal meeting ID (PMI)"
            accessibilityLabel="Use personal meeting ID (PMI)"
            value={usePmi && !!pmiCode}
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
