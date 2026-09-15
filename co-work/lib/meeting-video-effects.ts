import type {
  VideoEffectCapability,
  VideoEffectStatus,
  VirtualBackgroundSelection,
} from '~/co-work/lib/virtual-backgrounds'

export type MeetingVideoEffects = {
  capability: VideoEffectCapability
  status: VideoEffectStatus
  selection: VirtualBackgroundSelection
  error: string | null
  apply: (selection: VirtualBackgroundSelection) => Promise<boolean>
  retry: () => Promise<boolean>
}
