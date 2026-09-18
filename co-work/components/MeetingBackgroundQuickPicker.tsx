import { Image, Pressable } from 'react-native'
import type { ReactNode } from 'react'

import { Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import {
  BLUR_BACKGROUND,
  OFF_BACKGROUND,
  type VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'
import { getVirtualBackgroundPresets } from '~/co-work/lib/virtual-background-presets'

export type MeetingBackgroundQuickCustomItem = {
  id: string
  name: string
  imageUri?: string | null
  selection: VirtualBackgroundSelection
}

type MeetingBackgroundQuickPickerProps = {
  preview: ReactNode
  selection: VirtualBackgroundSelection
  busy?: boolean
  error?: string | null
  /** When false, blur/image tiles stay visible but selecting them shows the fallback message. */
  effectsAvailable?: boolean
  onSelect: (selection: VirtualBackgroundSelection) => void
  onUpload?: () => void
  uploadBusy?: boolean
  /** Previously uploaded customs — lets Join Now switch/replace images. */
  customItems?: MeetingBackgroundQuickCustomItem[]
  /** Active custom/preset image — shown as a confirmation strip under the camera. */
  selectedImageUri?: string | null
}

export function MeetingBackgroundQuickPicker({
  preview,
  selection,
  busy,
  error,
  effectsAvailable = true,
  onSelect,
  onUpload,
  uploadBusy,
  customItems = [],
  selectedImageUri,
}: MeetingBackgroundQuickPickerProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const presets = getVirtualBackgroundPresets()
  const active = (value: VirtualBackgroundSelection) =>
    selection.mode === value.mode && (value.mode !== 'image' || selection.id === value.id)

  return (
    <YStack gap="$3">
      <YStack gap="$1">
        <Text fontWeight="800" fontSize={15} color={coworkUi.text}>
          Background
        </Text>
        <Text fontSize={12} color={coworkUi.textSecondary}>
          Preview and apply before you join. You can change this again in the meeting.
        </Text>
      </YStack>
      <YStack
        height={210}
        borderRadius={18}
        overflow="hidden"
        backgroundColor="#130d10"
        borderWidth={1}
        borderColor={coworkUi.borderSoft}
      >
        {preview}
        {busy ? (
          <YStack
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(0,0,0,0.35)"
          >
            <Spinner color="#fff" />
          </YStack>
        ) : null}
        {selectedImageUri && selection.mode === 'image' ? (
          <XStack
            position="absolute"
            left={10}
            bottom={10}
            alignItems="center"
            gap="$2"
            paddingHorizontal="$2"
            paddingVertical={6}
            borderRadius={999}
            backgroundColor="rgba(0,0,0,0.72)"
            borderWidth={1}
            borderColor="rgba(255,255,255,0.2)"
          >
            <Image
              source={{ uri: selectedImageUri }}
              resizeMode="cover"
              style={{ width: 36, height: 24, borderRadius: 6 }}
            />
            <Text fontSize={11} color="#fff" fontWeight="700">
              Background selected
            </Text>
          </XStack>
        ) : null}
      </YStack>
      <XStack gap="$2" flexWrap="wrap">
        <QuickTile
          label="None"
          active={active(OFF_BACKGROUND)}
          icon={<Icons.Video size={18} color={coworkUi.text} />}
          onPress={() => onSelect(OFF_BACKGROUND)}
        />
        <QuickTile
          label="Blur"
          active={active(BLUR_BACKGROUND)}
          dimmed={!effectsAvailable}
          icon={<Icons.Wand2 size={18} color={coworkUi.text} />}
          onPress={() => onSelect(BLUR_BACKGROUND)}
        />
        {presets.map((preset) => (
          <QuickTile
            key={preset.id}
            label={preset.name}
            active={active(preset.selection)}
            dimmed={!effectsAvailable}
            imageSource={preset.thumbnail}
            onPress={() => onSelect(preset.selection)}
          />
        ))}
        {customItems.map((item) => (
          <QuickTile
            key={item.id}
            label={item.name}
            active={active(item.selection)}
            dimmed={!effectsAvailable}
            imageUri={item.imageUri}
            icon={<Icons.Image size={18} color={coworkUi.text} />}
            onPress={() => onSelect(item.selection)}
          />
        ))}
        {onUpload ? (
          <QuickTile
            label="Upload"
            active={false}
            // Upload must stay tappable even when live preview effects are offline —
            // preference still saves and applies after Join.
            busy={uploadBusy}
            icon={<Icons.Upload size={18} color={coworkUi.text} />}
            onPress={onUpload}
          />
        ) : null}
      </XStack>
      {!effectsAvailable ? (
        <Text fontSize={12} color={coworkUi.textMuted}>
          Live preview is limited on this device. Your selection is saved and will apply when you
          join.
        </Text>
      ) : null}
      {error ? (
        <Text fontSize={12} color={coworkUi.danger}>
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}

function QuickTile({
  label,
  active,
  onPress,
  icon,
  imageSource,
  imageUri,
  dimmed,
  busy,
}: {
  label: string
  active: boolean
  onPress: () => void
  icon?: ReactNode
  imageSource?: import('react-native').ImageSourcePropType
  imageUri?: string | null
  dimmed?: boolean
  busy?: boolean
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, busy: !!busy }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!!busy}
    >
      <YStack gap={4} width={66} alignItems="center" opacity={dimmed ? 0.55 : 1}>
        <YStack
          width={66}
          height={43}
          borderRadius={10}
          overflow="hidden"
          borderWidth={active ? 2 : 1}
          borderColor={active ? coworkUi.brand : coworkUi.borderSoft}
          backgroundColor={coworkUi.surface}
          alignItems="center"
          justifyContent="center"
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          ) : imageSource ? (
            <Image source={imageSource} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
          ) : (
            icon
          )}
          {busy ? (
            <YStack
              position="absolute"
              top={0}
              right={0}
              bottom={0}
              left={0}
              alignItems="center"
              justifyContent="center"
              backgroundColor="rgba(0,0,0,0.4)"
            >
              <Spinner size="small" color="#fff" />
            </YStack>
          ) : null}
        </YStack>
        <Text fontSize={9} color={active ? coworkUi.brand : coworkUi.textMuted} numberOfLines={1}>
          {label}
        </Text>
      </YStack>
    </Pressable>
  )
}
