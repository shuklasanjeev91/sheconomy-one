import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Image } from 'react-native'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'

import { Button, Icons, ScrollView, Slider, Spinner, Text, XStack, YStack, useAppToast } from '~/components/ui'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { MeetingSidePanel } from '~/co-work/components/MeetingSidePanel'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import {
  BLUR_BACKGROUND,
  MAX_BLUR_RADIUS,
  MIN_BLUR_RADIUS,
  OFF_BACKGROUND,
  type VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'
import { getVirtualBackgroundPresets } from '~/co-work/lib/virtual-background-presets'
import {
  customBackgroundSelection,
  deleteCustomVirtualBackground,
  listCustomVirtualBackgrounds,
  resolveVirtualBackgroundSelection,
  uploadCustomVirtualBackground,
  type CustomVirtualBackground,
} from '~/co-work/lib/virtual-background-storage'
import { pickImagesWithCrop } from '~/lib/media/pick-and-crop'
import { clearImageCropQueue } from '~/lib/media/crop-session'

type ResolvedCustomBackground = CustomVirtualBackground & { imageUrl?: string }

type MeetingBackgroundPanelProps = {
  userId: string
  effects: MeetingVideoEffects
  onClose: () => void
  fullWidth?: boolean
  /** Zoom-style: turn camera on before applying blur/image if needed. */
  onEnsureCamera?: () => void | Promise<void>
  cameraEnabled?: boolean
}

function selected(
  current: VirtualBackgroundSelection,
  candidate: VirtualBackgroundSelection,
): boolean {
  if (current.mode !== candidate.mode) return false
  if (current.mode !== 'image') return true
  return current.id === candidate.id
}

export function MeetingBackgroundPanel({
  userId,
  effects,
  onClose,
  fullWidth,
  onEnsureCamera,
  cameraEnabled = true,
}: MeetingBackgroundPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const presets = useMemo(() => getVirtualBackgroundPresets(), [])
  const [custom, setCustom] = useState<ResolvedCustomBackground[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const loadCustom = useCallback(async () => {
    setLoadingLibrary(true)
    try {
      const rows = await listCustomVirtualBackgrounds(userId)
      const resolved = await Promise.all(
        rows.map(async (row) => {
          try {
            const value = await resolveVirtualBackgroundSelection(customBackgroundSelection(row))
            return { ...row, imageUrl: value.imageUrl }
          } catch {
            return row
          }
        }),
      )
      setCustom(resolved)
    } catch (error) {
      toast.show('Could not load backgrounds', {
        tone: 'danger',
        message: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setLoadingLibrary(false)
    }
  }, [toast, userId])

  useEffect(() => {
    void loadCustom()
  }, [loadCustom])

  const applySelection = useCallback(
    async (value: VirtualBackgroundSelection): Promise<boolean> => {
      setBusyId(value.id ?? value.mode)
      try {
        if (value.mode !== 'off' && !cameraEnabled && onEnsureCamera) {
          await onEnsureCamera()
          // Give LiveKit a beat to publish the camera track before attaching effects.
          await new Promise((resolve) => setTimeout(resolve, 450))
        }
        const resolved = await resolveVirtualBackgroundSelection(value)
        if (resolved.mode === 'image' && !resolved.imageUrl) {
          toast.show('Background not applied', {
            tone: 'danger',
            message: 'Could not load the image file for this background.',
          })
          return false
        }
        const ok = await effects.apply(resolved)
        if (!ok) {
          toast.show('Background not applied', {
            tone: 'danger',
            message: effects.error ?? 'Turn on your camera and try again.',
          })
          return false
        }
        toast.show(
          resolved.mode === 'off'
            ? 'Background off'
            : resolved.mode === 'blur'
              ? 'Blur applied'
              : 'Background applied',
          { tone: 'success' },
        )
        return true
      } catch (error) {
        toast.show('Background not applied', {
          tone: 'danger',
          message: error instanceof Error ? error.message : undefined,
        })
        return false
      } finally {
        setBusyId(null)
      }
    },
    [cameraEnabled, effects, onEnsureCamera, toast],
  )

  const upload = useCallback(async () => {
    try {
      // Skip in-app crop during live meetings — InstantMeetingHost used to cover
      // ImageCropHost (hang = "nothing happens"). OS picker + server resize is enough.
      clearImageCropQueue()
      const picked = await pickImagesWithCrop({
        multiple: false,
        maxCount: 1,
        aspect: [16, 9],
        skipCrop: true,
        allowsEditing: false,
      })
      const image = picked[0]
      if (!image?.uri) return
      setBusyId('upload')
      const created = await uploadCustomVirtualBackground(userId, image)
      // Prefer local file for apply before library refresh (HTTPS decode fails natively).
      const applied = await applySelection(customBackgroundSelection(created))
      await loadCustom()
      if (!applied) {
        toast.show('Background uploaded', {
          tone: 'warning',
          message: 'Saved to your library — tap it again if the camera did not update.',
        })
      }
    } catch (error) {
      toast.show('Upload failed', {
        tone: 'danger',
        message: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusyId(null)
    }
  }, [applySelection, loadCustom, toast, userId])

  const remove = useCallback(
    (item: ResolvedCustomBackground) => {
      Alert.alert('Delete background?', item.name, [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusyId(item.id)
              try {
                await deleteCustomVirtualBackground(item)
                if (effects.selection.id === item.id) await effects.apply(OFF_BACKGROUND)
                await loadCustom()
              } catch (error) {
                toast.show('Could not delete background', {
                  tone: 'danger',
                  message: error instanceof Error ? error.message : undefined,
                })
              } finally {
                setBusyId(null)
              }
            })()
          },
        },
      ])
    },
    [effects, loadCustom, toast],
  )

  const tileBorder = (active: boolean) => active ? coworkUi.brand : coworkUi.borderSoft
  const quickPresets = presets.slice(0, 4)

  return (
    <MeetingSidePanel fullWidth={fullWidth}>
      <MeetingPanelHeader
        title={showAll ? 'All backgrounds' : 'Background'}
        subtitle="Visible to everyone in the meeting"
        icon={<Icons.Sparkles size={19} color={coworkUi.brand} />}
        onClose={onClose}
      />
      <ScrollView flex={1} contentContainerStyle={{ padding: 16, gap: 18 }}>
        {effects.capability === 'unavailable' ? (
          <YStack padding="$4" borderRadius={16} backgroundColor={coworkUi.dangerMuted} gap="$2">
            <Text fontWeight="700" color={coworkUi.danger}>Effects unavailable</Text>
            <Text fontSize={13} color={coworkUi.textSecondary}>
              Update SHEconomy or use a device with background-processing support. Your camera stays unfiltered.
            </Text>
          </YStack>
        ) : null}

        <YStack gap="$3">
          <Text fontWeight="800" color={coworkUi.text}>Quick picks</Text>
          <XStack gap="$3" flexWrap="wrap">
            <EffectTile
              label="None"
              active={selected(effects.selection, OFF_BACKGROUND)}
              borderColor={tileBorder(selected(effects.selection, OFF_BACKGROUND))}
              onPress={() => void applySelection(OFF_BACKGROUND)}
              busy={busyId === 'off'}
              icon={<Icons.Video size={23} color={coworkUi.text} />}
            />
            <EffectTile
              label="Blur"
              active={selected(effects.selection, BLUR_BACKGROUND)}
              borderColor={tileBorder(selected(effects.selection, BLUR_BACKGROUND))}
              onPress={() => void applySelection(BLUR_BACKGROUND)}
              busy={busyId === 'blur'}
              icon={<Icons.Wand2 size={23} color={coworkUi.text} />}
            />
            {(showAll ? presets : quickPresets).map((preset) => (
              <EffectTile
                key={preset.id}
                label={preset.name}
                imageSource={preset.thumbnail}
                active={selected(effects.selection, preset.selection)}
                borderColor={tileBorder(selected(effects.selection, preset.selection))}
                busy={busyId === preset.id}
                onPress={() => void applySelection(preset.selection)}
              />
            ))}
            {!showAll ? (
              <EffectTile
                label="See all"
                active={false}
                borderColor={coworkUi.borderSoft}
                onPress={() => setShowAll(true)}
                icon={<Icons.LayoutGrid size={23} color={coworkUi.text} />}
              />
            ) : null}
          </XStack>
          {effects.selection.mode === 'blur' ? (
            <YStack gap="$2" paddingHorizontal="$1">
              <XStack justifyContent="space-between">
                <Text fontSize={12} color={coworkUi.textMuted}>Soft</Text>
                <Text fontSize={12} color={coworkUi.textMuted}>Strong</Text>
              </XStack>
              <Slider
                min={MIN_BLUR_RADIUS}
                max={MAX_BLUR_RADIUS}
                step={1}
                value={[effects.selection.blurRadius ?? 12]}
                onSlideEnd={(value) =>
                  void applySelection({ mode: 'blur', id: 'blur', blurRadius: value[0] })
                }
              />
            </YStack>
          ) : null}
        </YStack>

        <YStack gap="$3">
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontWeight="800" color={coworkUi.text}>My backgrounds</Text>
            {loadingLibrary ? <Spinner size="small" color={coworkUi.brand} /> : null}
          </XStack>
          <XStack gap="$3" flexWrap="wrap">
            <EffectTile
              label="Upload"
              active={false}
              borderColor={coworkUi.borderSoft}
              onPress={() => void upload()}
              busy={busyId === 'upload'}
              icon={<Icons.Upload size={23} color={coworkUi.text} />}
            />
            {custom.map((item) => {
              const value = { ...customBackgroundSelection(item), imageUrl: item.imageUrl }
              return (
                <EffectTile
                  key={item.id}
                  label={item.name}
                  imageUri={item.imageUrl}
                  active={selected(effects.selection, value)}
                  borderColor={tileBorder(selected(effects.selection, value))}
                  busy={busyId === item.id}
                  onPress={() => void applySelection(value)}
                  onDelete={() => remove(item)}
                />
              )
            })}
          </XStack>
          {!loadingLibrary && custom.length === 0 ? (
            <Text fontSize={13} color={coworkUi.textMuted}>
              Upload a 16:9 image to use it behind you in this meeting.
            </Text>
          ) : null}
        </YStack>

        {showAll ? (
          <Button tone="ghost" size="$3" alignSelf="flex-start" onPress={() => setShowAll(false)}>
            Back to quick picks
          </Button>
        ) : null}

        {effects.error ? (
          <YStack gap="$2" padding="$3" borderRadius={14} backgroundColor={coworkUi.dangerMuted}>
            <Text fontSize={13} color={coworkUi.danger}>{effects.error}</Text>
            <Button size="$2" tone="outline" onPress={() => void effects.retry()}>Try again</Button>
          </YStack>
        ) : null}
      </ScrollView>
    </MeetingSidePanel>
  )
}

function EffectTile({
  label,
  active,
  borderColor,
  onPress,
  onDelete,
  busy,
  icon,
  imageSource,
  imageUri,
}: {
  label: string
  active: boolean
  borderColor: string
  onPress: () => void
  onDelete?: () => void
  busy?: boolean
  icon?: ReactNode
  imageSource?: import('react-native').ImageSourcePropType
  imageUri?: string
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  return (
    <YStack width={118} gap="$1">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active, busy: !!busy }}
        accessibilityLabel={label}
        onPress={onPress}
        style={{ width: '100%' }}
      >
        <YStack
          height={72}
          borderRadius={14}
          overflow="hidden"
          borderWidth={active ? 3 : 1}
          borderColor={borderColor}
          alignItems="center"
          justifyContent="center"
          backgroundColor="#1a1218"
        >
          {imageSource || imageUri ? (
            <Image
              source={imageSource ?? { uri: imageUri }}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
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
              backgroundColor="rgba(0,0,0,0.45)"
            >
              <Spinner size="small" color="#fff" />
            </YStack>
          ) : null}
        </YStack>
      </Pressable>
      <XStack alignItems="center" justifyContent="space-between" gap="$1">
        <Text
          flex={1}
          fontSize={11}
          color={active ? coworkUi.brand : coworkUi.textSecondary}
          numberOfLines={1}
        >
          {label}
        </Text>
        {onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${label}`}
            onPress={onDelete}
            hitSlop={8}
          >
            <Icons.Trash2 size={14} color={coworkUi.danger} />
          </Pressable>
        ) : null}
      </XStack>
    </YStack>
  )
}
