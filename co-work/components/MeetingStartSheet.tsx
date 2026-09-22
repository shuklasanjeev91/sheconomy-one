import { useEffect, useState } from 'react'
import { Modal, Pressable, Switch as RNSwitch } from 'react-native'

import { Button, Icons, Text, XStack, YStack } from '~/components/ui'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { formatMeetingCode } from '~/co-work/lib/meetings'

type MeetingStartSheetProps = {
  open: boolean
  onClose: () => void
  pmiCode?: string | null
  onStart: (options: { videoOn: boolean; usePmi: boolean }) => void
}

/**
 * Zoom "Start a meeting" — bottom sheet on phone, centered modal on iPad/large.
 */
export function MeetingStartSheet({ open, onClose, pmiCode, onStart }: MeetingStartSheetProps) {
  const { ui } = useCoWorkTheme()
  const { isTablet, isDesktop } = useAppLayout()
  const centered = isTablet || isDesktop
  const [videoOn, setVideoOn] = useState(true)
  const [usePmi, setUsePmi] = useState(false)

  useEffect(() => {
    if (!open) return
    setVideoOn(true)
    setUsePmi(false)
  }, [open])

  if (!open) return null

  const sheet = (
    <YStack
      backgroundColor={centered ? '#FFFFFF' : ui.surfaceElevated}
      borderRadius={centered ? 16 : 0}
      borderTopLeftRadius={centered ? 16 : 18}
      borderTopRightRadius={centered ? 16 : 18}
      width={centered ? '100%' : undefined}
      maxWidth={centered ? 420 : undefined}
      paddingBottom="$5"
      borderWidth={1}
      borderColor={centered ? 'rgba(0,0,0,0.08)' : ui.borderSoft}
      style={
        centered
          ? { boxShadow: '0 24px 64px rgba(0,0,0,0.28)' }
          : undefined
      }
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="$4"
        paddingVertical="$3.5"
        borderBottomWidth={1}
        borderBottomColor={centered ? 'rgba(0,0,0,0.06)' : ui.borderSoft}
      >
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          {centered ? (
            <Icons.X size={20} color="#111" />
          ) : (
            <Text color={ui.brand} fontSize={15} fontWeight="700">
              Cancel
            </Text>
          )}
        </Pressable>
        <Text color={centered ? '#111' : ui.text} fontSize={16} fontWeight="800">
          Start a meeting
        </Text>
        <YStack width={28} />
      </XStack>

      <YStack>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3.5"
          borderBottomWidth={1}
          borderBottomColor={centered ? 'rgba(0,0,0,0.06)' : ui.borderSoft}
        >
          <Text color={centered ? '#111' : ui.text} fontSize={15} fontWeight="600">
            Video on
          </Text>
          <RNSwitch
            value={videoOn}
            onValueChange={setVideoOn}
            trackColor={{ false: centered ? '#D1D5DB' : '#4E2138', true: ui.brand }}
            thumbColor="#fff"
          />
        </XStack>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          paddingHorizontal="$4"
          paddingVertical="$3.5"
          gap="$3"
        >
          <YStack flex={1} gap={2}>
            <Text color={centered ? '#111' : ui.text} fontSize={15} fontWeight="600">
              Use personal meeting ID (PMI)
            </Text>
            {pmiCode ? (
              <Text color={centered ? '#6B7280' : ui.textMuted} fontSize={13} fontWeight="600">
                {formatMeetingCode(pmiCode)}
              </Text>
            ) : null}
          </YStack>
          <RNSwitch
            value={usePmi}
            onValueChange={setUsePmi}
            disabled={!pmiCode}
            trackColor={{ false: centered ? '#D1D5DB' : '#4E2138', true: ui.brand }}
            thumbColor="#fff"
          />
        </XStack>
      </YStack>

      <YStack paddingHorizontal="$4" paddingTop="$4">
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
      </YStack>
    </YStack>
  )

  return (
    <Modal
      visible={open}
      transparent
      animationType={centered ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: centered ? 'center' : 'flex-end',
          alignItems: centered ? 'center' : 'stretch',
          paddingHorizontal: centered ? 24 : 0,
        }}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: centered ? '100%' : undefined, maxWidth: centered ? 420 : undefined }}>
          {sheet}
        </Pressable>
      </Pressable>
    </Modal>
  )
}
