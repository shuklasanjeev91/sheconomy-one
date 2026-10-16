import { useState } from 'react'

import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { MeetingPanelHeader } from '~/co-work/components/MeetingPanelHeader'
import { MeetingSidePanel } from '~/co-work/components/MeetingSidePanel'
import { Icons, ScrollView, Text, YStack, useAppToast } from '~/components/ui'
import type { MeetingVideoEffects } from '~/co-work/lib/meeting-video-effects'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import {
  VIDEO_FILTERS,
  normalizeVideoFilter,
  type VideoFilterId,
  type VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'

type MeetingFiltersPanelProps = {
  effects: MeetingVideoEffects
  onClose: () => void
  fullWidth?: boolean
  onEnsureCamera?: () => void | Promise<void>
  cameraEnabled?: boolean
}

export function MeetingFiltersPanel({
  effects,
  onClose,
  fullWidth,
  onEnsureCamera,
  cameraEnabled = true,
}: MeetingFiltersPanelProps) {
  const { ui: coworkUi } = useCoWorkTheme()
  const toast = useAppToast()
  const [busyId, setBusyId] = useState<VideoFilterId | null>(null)
  const active = normalizeVideoFilter(effects.selection.filter)

  async function applyFilter(filter: VideoFilterId) {
    setBusyId(filter)
    try {
      if (filter !== 'none' && !cameraEnabled && onEnsureCamera) {
        await onEnsureCamera()
        await new Promise((resolve) => setTimeout(resolve, 450))
      }
      const next: VirtualBackgroundSelection =
        filter === 'none'
          ? { ...effects.selection, filter: undefined }
          : { ...effects.selection, filter }
      const ok = await effects.apply(next)
      if (!ok) {
        toast.show('Filter not applied', {
          tone: 'danger',
          message: effects.error ?? 'Turn on your camera and try again.',
        })
        return
      }
      const label = VIDEO_FILTERS.find((row) => row.id === filter)?.label ?? 'Filter'
      toast.show(filter === 'none' ? 'Filter off' : `${label} applied`, { tone: 'success' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <MeetingSidePanel fullWidth={fullWidth}>
      <MeetingPanelHeader
        title="Video filters"
        subtitle="Color grade on your camera. Stacks with blur and backgrounds."
        icon={<Icons.Sparkles size={19} color={coworkUi.brandLight} />}
        onClose={onClose}
      />
      <ScrollView flex={1} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {effects.capability === 'unavailable' ? (
          <YStack padding="$4" borderRadius={16} backgroundColor={coworkUi.dangerMuted} gap="$2">
            <Text fontWeight="700" color={coworkUi.danger}>
              Filters unavailable
            </Text>
            <Text fontSize={13} color={coworkUi.textSecondary}>
              This device cannot process the camera. Your video stays unchanged.
            </Text>
          </YStack>
        ) : null}
        <YStack gap="$2">
          {VIDEO_FILTERS.map((filter) => {
            const selected = active === filter.id
            return (
              <Pressable
                key={filter.id}
                disabled={busyId != null}
                onPress={() => void applyFilter(filter.id)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: selected ? coworkUi.brand : coworkUi.borderSoft,
                  backgroundColor: pressed || selected ? coworkUi.brandMuted : coworkUi.surfaceMuted,
                  opacity: busyId && busyId !== filter.id ? 0.6 : 1,
                })}
              >
                <YStack flex={1} gap={2}>
                  <Text color={coworkUi.text} fontSize={15} fontWeight="800">
                    {filter.label}
                  </Text>
                  <Text color={coworkUi.textSecondary} fontSize={12}>
                    {filter.id === 'none'
                      ? 'Original camera color'
                      : filter.id === 'soft'
                        ? 'Slightly brighter and softer'
                        : 'Visible to everyone in the meeting'}
                  </Text>
                </YStack>
                {selected ? <Icons.Check size={18} color={coworkUi.brand} /> : null}
              </Pressable>
            )
          })}
        </YStack>
      </ScrollView>
    </MeetingSidePanel>
  )
}
