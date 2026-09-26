import { Image } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { useState, type ReactNode } from 'react'

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
  /** Overlay pinned inside the 16:9 video stage (name badge, mute state). */
  videoOverlay?: ReactNode
  showHeader?: boolean
  showTrayToggle?: boolean
  pickerOpen?: boolean
  onTogglePicker?: () => void
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
  videoOverlay,
  showHeader = false,
  showTrayToggle = true,
  pickerOpen,
  onTogglePicker,
}: MeetingBackgroundQuickPickerProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const presets = getVirtualBackgroundPresets()
  const [internalShowPicker, setInternalShowPicker] = useState(false)
  const isPickerOpen = pickerOpen !== undefined ? pickerOpen : internalShowPicker

  const togglePicker = () => {
    if (onTogglePicker) onTogglePicker()
    else setInternalShowPicker((prev) => !prev)
  }

  const openPicker = () => {
    if (pickerOpen !== undefined) {
      if (!pickerOpen && onTogglePicker) onTogglePicker()
    } else {
      setInternalShowPicker(true)
    }
  }

  const active = (value: VirtualBackgroundSelection) =>
    selection.mode === value.mode && (value.mode !== 'image' || selection.id === value.id)

  return (
    <YStack gap="$2.5" width="100%" style={{ position: 'relative' }}>
      {showHeader ? (
        <YStack gap="$1">
          <Text fontWeight="800" fontSize={15} color={coworkUi.text}>
            Background
          </Text>
          <Text fontSize={12} color={coworkUi.textSecondary}>
            Preview and apply before you join. You can change this again in the meeting.
          </Text>
        </YStack>
      ) : null}
      <YStack
        width="100%"
        aspectRatio={16 / 9}
        borderRadius={16}
        overflow="hidden"
        backgroundColor="#0a0a0c"
        borderWidth={1}
        borderColor="rgba(255, 255, 255, 0.1)"
        position="relative"
        flexShrink={0}
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
            backgroundColor="rgba(0,0,0,0.5)"
          >
            <Spinner color="#fff" />
          </YStack>
        ) : null}

        {selectedImageUri && selection.mode === 'image' && !isPickerOpen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Virtual background settings"
            onPress={openPicker}
            style={({ pressed }) => ({
              position: 'absolute',
              left: videoOverlay ? undefined : 12,
              right: videoOverlay ? 12 : undefined,
              bottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: pressed ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.76)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
              zIndex: 35,
              cursor: 'pointer',
            })}
          >
            <Image
              source={{ uri: selectedImageUri }}
              resizeMode="cover"
              style={{ width: 28, height: 18, borderRadius: 4 }}
            />
            <Text fontSize={11} color="#fff" fontWeight="700">
              Virtual background
            </Text>
            <Icons.ChevronUp size={13} color="#fff" />
          </Pressable>
        ) : null}

        {videoOverlay ? (
          <YStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            zIndex={20}
            pointerEvents="box-none"
          >
            {videoOverlay}
          </YStack>
        ) : null}

        {showTrayToggle && !videoOverlay ? (
          <XStack
            position="absolute"
            top={10}
            right={10}
            zIndex={30}
            backgroundColor="rgba(18, 14, 20, 0.78)"
            borderRadius={999}
            paddingHorizontal="$2.5"
            paddingVertical="$1.5"
            borderWidth={1}
            borderColor={isPickerOpen ? coworkUi.brand : 'rgba(255,255,255,0.18)'}
            alignItems="center"
            gap="$1.5"
            cursor="pointer"
            pressStyle={{ opacity: 0.85 }}
            onPress={togglePicker}
            maxWidth="55%"
          >
            <Icons.Wand2 size={13} color={isPickerOpen ? coworkUi.brand : '#fff'} />
            <Text fontSize={11} fontWeight="700" color="#fff" numberOfLines={1} flexShrink={1}>
              {selection.mode !== 'off' ? 'Background active' : 'Background'}
            </Text>
          </XStack>
        ) : null}
      </YStack>

      {/* Virtual Background Quick Tiles — collapsible or always visible */}
      {isPickerOpen || !showTrayToggle ? (
        <YStack
          gap="$2"
          padding="$2.5"
          borderRadius={12}
          backgroundColor="rgba(0,0,0,0.4)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.08)"
        >
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
        </YStack>
      ) : null}
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
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = !!(imageUri || imageSource) && !imageFailed

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, busy: !!busy }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={!!busy}
      style={({ pressed }) => ({
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.6 : pressed ? 0.8 : 1,
      })}
    >
      <YStack gap={4} width={66} alignItems="center" opacity={dimmed ? 0.55 : 1}>
        <YStack
          width={66}
          height={43}
          borderRadius={10}
          overflow="hidden"
          borderWidth={active ? 2 : 1}
          borderColor={active ? coworkUi.brand : coworkUi.borderSoft}
          backgroundColor={hasImage ? '#1a1218' : coworkUi.surfaceMuted}
          alignItems="center"
          justifyContent="center"
        >
          {imageUri && !imageFailed ? (
            <Image
              source={{ uri: imageUri }}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
              style={{ width: '100%', height: '100%' }}
            />
          ) : imageSource && !imageFailed ? (
            <Image
              source={imageSource}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            icon ?? <Icons.Image size={18} color={coworkUi.textMuted} />
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
