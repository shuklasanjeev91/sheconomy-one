import { Platform } from 'react-native'

import { useChatTheme } from '~/chat/lib/chat-theme'
import { AppBottomSheet, Icons, Text, XStack, YStack } from '~/components/ui'

type AttachmentSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPickGallery: () => void
  onPickCamera: () => void
  onPickDocument: () => void
  onPickPoll?: () => void
  onPickEvent?: () => void
}

function AttachTile({
  icon,
  label,
  color,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  color: string
  onPress: () => void
}) {
  const theme = useChatTheme()
  return (
    <YStack alignItems="center" gap={8} onPress={onPress} cursor="pointer" width={92}>
      <YStack
        width={62}
        height={62}
        borderRadius={999}
        alignItems="center"
        justifyContent="center"
        backgroundColor={color}
        pressStyle={{ scale: 0.92 }}
        hoverStyle={{ opacity: 0.9 }}
        animation="quick"
      >
        {icon}
      </YStack>
      <Text fontSize={13} color={theme.textSecondary}>
        {label}
      </Text>
    </YStack>
  )
}

export function AttachmentSheet({
  open,
  onOpenChange,
  onPickGallery,
  onPickCamera,
  onPickDocument,
  onPickPoll,
  onPickEvent,
}: AttachmentSheetProps) {
  function pick(action: () => void) {
    if (Platform.OS === 'web') {
      // Open the native file dialog synchronously within the user gesture, then
      // close the sheet — closing first can suppress the picker on web.
      action()
      onOpenChange(false)
    } else {
      // On native, dismiss the sheet before launching the picker to avoid
      // stacking two native modals.
      onOpenChange(false)
      action()
    }
  }

  return (
    <AppBottomSheet open={open} onOpenChange={onOpenChange} title="Share" scrollable={false}>
      <XStack gap={16} paddingVertical={8} paddingHorizontal={4} flexWrap="wrap">
        <AttachTile
          icon={<Icons.Image size={26} color="#ffffff" />}
          label="Gallery"
          color="#8a3ffc"
          onPress={() => pick(onPickGallery)}
        />
        <AttachTile
          icon={<Icons.Camera size={26} color="#ffffff" />}
          label="Camera"
          color="#f2385a"
          onPress={() => pick(onPickCamera)}
        />
        <AttachTile
          icon={<Icons.FileText size={26} color="#ffffff" />}
          label="Document"
          color="#4b7bec"
          onPress={() => pick(onPickDocument)}
        />
        {onPickPoll ? (
          <AttachTile
            icon={<Icons.BarChart2 size={26} color="#ffffff" />}
            label="Poll"
            color="#c37dda"
            onPress={() => pick(onPickPoll)}
          />
        ) : null}
        {onPickEvent ? (
          <AttachTile
            icon={<Icons.Calendar size={26} color="#ffffff" />}
            label="Event"
            color="#e7a33e"
            onPress={() => pick(onPickEvent)}
          />
        ) : null}
      </XStack>
    </AppBottomSheet>
  )
}
