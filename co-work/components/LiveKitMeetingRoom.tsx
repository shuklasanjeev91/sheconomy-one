export type { LiveKitMediaControls, LiveKitMeetingRoomProps } from '~/co-work/lib/livekit-media-controls'
/**
 * Web/SSR default. Native builds resolve `LiveKitMeetingRoom.native.tsx` first.
 * Keeping the default web-safe avoids blank meeting screens when platform
 * extensions fail to resolve (Vite would otherwise load the native entry).
 */
export { LiveKitMeetingRoom, useLiveKitMediaControls } from '~/co-work/components/LiveKitMeetingRoom.web'
