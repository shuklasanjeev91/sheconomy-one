import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectionState, DisconnectReason, RoomEvent, Track, type Room } from 'livekit-client'

import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'

import { Button, Icons, Spinner, Text, XStack, YStack } from '~/components/ui'
import { ScreenCenter, ScreenFill, ViewportOverlay } from '~/components/layout'
import { MeetingVideoStage } from '~/co-work/components/MeetingVideoStage'
import { useLiveKitMediaControls } from '~/co-work/hooks/useLiveKitMediaControls.web'
import { fetchLiveKitCredentials } from '~/co-work/lib/livekit'
import { MeetingLifecycleBanner } from '~/co-work/components/MeetingLifecycleBanner'
import { reinforceCallMediaOnConnect } from '~/co-work/lib/livekit-call-media'
import { buildParticipantMetadata } from '~/co-work/lib/participant-avatar'
import { getLiveKitRoomOptions } from '~/co-work/lib/livekit-room-options'
import { bindRemoteScreenShareQuality } from '~/co-work/lib/livekit-screen-share'
import type { LiveKitMediaControls, LiveKitMeetingRoomProps } from '~/co-work/lib/livekit-media-controls'
import { useCoWorkTheme, type CoWorkShadows, type CoWorkUiTokens } from '~/co-work/lib/theme'
import { fetchLiveKitConfig, type LiveKitConfig } from '~/lib/livekit/config'
import { supportsLiveKitVideo } from '~/lib/platform/capabilities'
import { coworkBoxShadow, pageGradientStyle } from '~/lib/platform/crossStyles'
import { meetingViewportStyle } from '~/lib/platform/viewport'
import { useMeetingGalleryTracks } from '~/co-work/hooks/useMeetingGalleryTracks'
import { useMeetingLifecycle } from '~/co-work/hooks/useMeetingLifecycle.web'

export type { LiveKitMediaControls, LiveKitMeetingRoomProps } from '~/co-work/lib/livekit-media-controls'
export { useLiveKitMediaControls } from '~/co-work/hooks/useLiveKitMediaControls.web'

function getSheconomyLivekitCss(ui: CoWorkUiTokens, shadows: CoWorkShadows) {
  return `
  .sheconomy-livekit-room {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 100%;
    pointer-events: none;
  }
  .sheconomy-video-stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: #0c080a;
    padding: 88px 12px 112px;
    box-sizing: border-box;
  }
  .sheconomy-video-stage--landscape-phone {
    /* Padding comes from inline chrome vars — keep CSS padding as fallback only. */
    padding: var(--stage-pad-top, 62px) var(--stage-pad-right, 10px)
      var(--stage-pad-bottom, 82px) var(--stage-pad-left, 10px);
  }
  .sheconomy-video-stage--portrait-phone {
    padding: var(--stage-pad-top, 88px) var(--stage-pad-right, 12px)
      var(--stage-pad-bottom, 108px) var(--stage-pad-left, 12px);
  }
  .sheconomy-screen-share-status {
    position: absolute;
    top: 96px;
    left: 50%;
    z-index: 20;
    transform: translateX(-50%);
    padding: 8px 14px;
    border-radius: 999px;
    color: #ecfdf5;
    background: rgba(5, 150, 105, 0.92);
    border: 1px solid rgba(167, 243, 208, 0.48);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    pointer-events: none;
  }
  .sheconomy-screen-share-status--viewing {
    background: rgba(37, 99, 235, 0.92);
    border-color: rgba(147, 197, 253, 0.5);
  }
  .sheconomy-video-gallery {
    display: grid;
    grid-template-columns: repeat(var(--gallery-cols, 1), minmax(0, 1fr));
    grid-template-rows: repeat(var(--gallery-rows, 1), minmax(0, 1fr));
    width: 100%;
    height: 100%;
    min-height: 0;
    gap: 10px;
    box-sizing: border-box;
    align-items: stretch;
    justify-items: stretch;
  }
  .sheconomy-video-gallery--solo {
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }
  .sheconomy-video-gallery--solo .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    flex: 1;
  }
  .sheconomy-video-pip {
    position: absolute;
    right: 20px;
    bottom: 120px;
    width: min(28vw, 240px);
    aspect-ratio: 16 / 9;
    z-index: 15;
    border-radius: ${ui.radius.tile}px;
    overflow: hidden;
    border: 1px solid ${ui.glassBorder};
    box-shadow: ${shadows.tile};
    background: ${ui.tileBg};
    pointer-events: auto;
  }
  .sheconomy-video-pip .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
    border-radius: ${ui.radius.tile}px;
  }
  @media (max-width: 768px) {
    .sheconomy-video-pip {
      width: min(40vw, 148px);
      right: 12px;
      bottom: 112px;
    }
  }
  .sheconomy-participant-tile.lk-participant-tile {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    border-radius: ${ui.radius.tile}px;
    border: 1px solid ${ui.glassBorder};
    background: ${ui.tileBg};
    overflow: hidden;
    box-shadow: ${shadows.tile};
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .sheconomy-participant-tile video,
  .sheconomy-participant-tile .lk-video-track {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    object-position: center center;
    background: #0c080a;
    display: block !important;
    position: absolute !important;
    inset: 0 !important;
    z-index: 1;
  }
  /* Self-view only — web LiveKit VideoTrack has no native mirror prop. */
  .sheconomy-participant-tile video.sheconomy-video--mirrored,
  .sheconomy-participant-tile .lk-video-track.sheconomy-video--mirrored {
    transform: scaleX(-1) !important;
  }
  .sheconomy-participant-tile[data-lk-source='screen_share'] video,
  .sheconomy-participant-tile[data-lk-source='screen_share'] .lk-video-track,
  .sheconomy-video-gallery--screen .sheconomy-participant-tile[data-lk-source='screen_share'] video {
    object-fit: contain !important;
    background: #0c080a;
    z-index: 2;
  }
  .sheconomy-video-gallery--screen {
    display: flex;
    align-items: stretch;
    justify-content: center;
  }
  .sheconomy-video-gallery--screen .sheconomy-participant-tile[data-lk-source='screen_share'] {
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
  }
  .sheconomy-video-gallery--speaker {
    display: flex;
    align-items: stretch;
    justify-content: center;
    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .sheconomy-video-gallery--speaker .sheconomy-participant-tile {
    width: 100%;
    height: 100%;
    max-width: 100%;
    flex: 1 1 auto;
  }
  .sheconomy-video-stage--speaker.sheconomy-video-stage--filmstrip-beside
    .sheconomy-video-gallery--speaker {
    margin-right: calc(var(--filmstrip-width, 176px) + 12px);
    width: calc(100% - var(--filmstrip-width, 176px) - 12px);
  }
  .sheconomy-video-stage--speaker.sheconomy-video-stage--filmstrip-bottom
    .sheconomy-video-gallery--speaker {
    margin-right: 0;
    margin-bottom: calc(var(--filmstrip-height, 96px) + 8px);
    width: 100%;
    height: calc(100% - var(--filmstrip-height, 96px) - 8px);
  }
  .sheconomy-video-filmstrip {
    position: absolute;
    top: 88px;
    right: 12px;
    bottom: 112px;
    width: var(--filmstrip-width, 176px);
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    z-index: 12;
    pointer-events: auto;
    resize: horizontal;
    min-width: 144px;
    max-width: min(360px, 42vw);
    padding: 4px;
    border-radius: 12px;
    background: rgba(12, 8, 10, 0.76);
    box-sizing: border-box;
  }
  .sheconomy-video-filmstrip__header {
    min-height: 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 2px 4px;
    color: rgba(255, 255, 255, 0.82);
    font-size: 11px;
    font-weight: 700;
    cursor: grab;
    user-select: none;
    touch-action: none;
  }
  .sheconomy-video-filmstrip__header:active {
    cursor: grabbing;
  }
  .sheconomy-video-filmstrip__header button {
    width: 28px;
    height: 28px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    cursor: pointer;
  }
  .sheconomy-video-filmstrip--minimized {
    width: 44px;
    min-width: 44px;
    height: 44px;
    bottom: auto;
    resize: none;
    overflow: hidden;
  }
  .sheconomy-video-filmstrip .sheconomy-participant-tile {
    width: 100%;
    min-height: 96px;
    flex: 0 0 110px;
  }
  .sheconomy-video-stage--filmstrip .sheconomy-video-gallery {
    margin-right: calc(var(--filmstrip-width, 176px) + 12px);
    width: calc(100% - var(--filmstrip-width, 176px) - 12px);
  }
  .sheconomy-video-stage--filmstrip-bottom.sheconomy-video-stage--filmstrip .sheconomy-video-gallery {
    margin-right: 0;
    margin-bottom: calc(var(--filmstrip-height, 92px) + 8px);
    width: 100%;
    height: calc(100% - var(--filmstrip-height, 92px) - 8px);
  }
  .sheconomy-video-stage--filmstrip-bottom.sheconomy-video-stage--filmstrip-minimized
    .sheconomy-video-gallery {
    margin-bottom: 52px;
    height: calc(100% - 52px);
  }
  .sheconomy-video-stage--filmstrip-beside .sheconomy-video-filmstrip {
    top: 0;
    right: 0;
    bottom: 0;
    left: auto;
    width: var(--filmstrip-width, 176px);
    height: auto;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    resize: horizontal;
    min-width: 104px;
    max-width: min(360px, 42vw);
  }
  .sheconomy-video-stage--filmstrip-bottom .sheconomy-video-filmstrip {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    height: var(--filmstrip-height, 92px);
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    resize: none;
    min-width: 0;
    max-width: none;
    transform: none !important;
  }
  .sheconomy-video-stage--filmstrip-bottom .sheconomy-video-filmstrip--minimized {
    left: auto;
    width: 44px;
    min-width: 44px;
    height: 44px;
  }
  .sheconomy-video-stage--filmstrip-bottom .sheconomy-video-filmstrip__header {
    position: sticky;
    left: 0;
    flex: 0 0 auto;
    min-width: 36px;
  }
  .sheconomy-video-stage--filmstrip-bottom .sheconomy-video-filmstrip .sheconomy-participant-tile {
    width: 132px;
    min-width: 132px;
    min-height: 0;
    height: 84px;
    flex-basis: 132px;
  }
  .sheconomy-video-stage--landscape-phone .sheconomy-video-filmstrip {
    top: 0;
    right: 0;
    bottom: 0;
    min-width: 104px;
    max-width: 132px;
    resize: none;
  }
  .sheconomy-video-stage--landscape-phone .sheconomy-gallery-pagination {
    bottom: 12px;
  }
  .sheconomy-video-filmstrip__overflow {
    min-width: 72px;
    min-height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: rgba(255,255,255,0.12);
    color: #fff;
    font-weight: 800;
    font-size: 15px;
    flex-shrink: 0;
  }
  .sheconomy-gallery-pagination {
    position: absolute;
    left: 50%;
    bottom: 118px;
    transform: translateX(-50%);
    z-index: 18;
    display: flex;
    align-items: center;
    gap: 10px;
    color: #fff;
    border-radius: 999px;
    padding: 6px 10px;
    background: rgba(12, 8, 10, 0.82);
    pointer-events: auto;
  }
  .sheconomy-gallery-pagination button {
    color: #fff;
    background: transparent;
    border: 0;
    cursor: pointer;
    font-weight: 700;
  }
  .sheconomy-gallery-pagination button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .sheconomy-gallery-pagination__dots {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sheconomy-gallery-pagination__dot {
    width: 7px;
    height: 7px;
    padding: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.35);
    min-width: 7px;
  }
  .sheconomy-gallery-pagination__dot--active {
    width: 10px;
    height: 10px;
    background: #f9a8d4;
  }
  /* Legacy narrow portrait fallback when policy classes are absent. */
  @media (max-width: 768px) and (orientation: portrait) {
    .sheconomy-video-stage:not(.sheconomy-video-stage--filmstrip-beside):not(
        .sheconomy-video-stage--filmstrip-bottom
      )
      .sheconomy-video-filmstrip {
      top: auto;
      left: 12px;
      right: 12px;
      bottom: 112px;
      width: auto;
      height: 92px;
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
      resize: none;
      min-width: 0;
      max-width: none;
      transform: none !important;
      padding: 4px;
    }
    .sheconomy-video-stage:not(.sheconomy-video-stage--filmstrip-beside):not(
        .sheconomy-video-stage--filmstrip-bottom
      )
      .sheconomy-video-stage--filmstrip
      .sheconomy-video-gallery {
      margin-right: 0;
      margin-bottom: 100px;
      width: 100%;
      height: calc(100% - 100px);
    }
  }
  .sheconomy-video-gallery .lk-participant-placeholder {
    background: #1a1216;
  }
  .sheconomy-participant-tile .lk-participant-placeholder[data-camera-off='true'] {
    opacity: 1;
  }
  .sheconomy-participant-tile[data-lk-source='screen_share'] .lk-participant-placeholder {
    /* Never paint the camera-off avatar over a screen-share tile. */
    background: #0c080a;
    z-index: 0;
  }
  .sheconomy-screen-waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
    z-index: 0;
  }
  .sheconomy-participant-avatar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px;
  }
  .sheconomy-participant-avatar-wrap .sheconomy-participant-avatar-label,
  .sheconomy-participant-avatar-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.55);
  }
  .sheconomy-participant-tile.lk-participant-tile[data-lk-speaking='true'] {
    border-color: ${ui.brandLight};
    box-shadow: 0 0 0 2px ${ui.brandGlow}, ${shadows.tile};
  }
  .sheconomy-hand-raised {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 4;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    background: rgba(12, 8, 10, 0.78);
    border: 1px solid ${ui.brandLight};
    box-shadow: 0 0 0 2px ${ui.brandGlow};
  }
  .sheconomy-hand-raised-inline {
    margin-left: 6px;
  }
  .sheconomy-participant-tile .lk-participant-metadata {
    background: linear-gradient(180deg, transparent 0%, rgba(12, 8, 10, 0.88) 100%);
    padding: 12px 14px;
    backdrop-filter: blur(8px);
  }
  .sheconomy-participant-tile .lk-participant-metadata-item {
    color: ${ui.text};
    font-size: 12px;
    font-weight: 600;
  }
  .sheconomy-participant-tile .lk-focus-toggle-button {
    display: none !important;
  }
  .sheconomy-participant-tile .lk-connection-quality,
  .sheconomy-connection-quality {
    display: inline-flex !important;
    opacity: 0.9 !important;
  }
  .sheconomy-tile-role {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 5;
  }
  .sheconomy-speaking-indicator {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    border-radius: inherit;
    box-shadow: inset 0 0 0 3px ${ui.brandLight};
  }
  .sheconomy-mic-muted {
    margin-right: 4px;
    font-size: 11px;
  }
  .sheconomy-video-gallery--grid {
    display: grid;
    grid-template-columns: repeat(var(--gallery-cols, 1), minmax(0, 1fr));
    grid-template-rows: repeat(var(--gallery-rows, 1), minmax(0, 1fr));
    width: 100%;
    height: 100%;
    min-height: 0;
    gap: 10px;
  }
  .sheconomy-video-gallery--grid > .sheconomy-participant-tile,
  .sheconomy-video-gallery--grid > .lk-participant-tile {
    min-width: 0;
    min-height: 0;
    width: 100%;
    height: 100%;
  }
  .sheconomy-video-gallery .lk-pagination-control,
  .sheconomy-video-gallery .lk-pagination-indicator {
    color: ${ui.textSecondary};
  }
  .sheconomy-livekit-room .lk-control-bar,
  .sheconomy-livekit-room .lk-chat-toggle,
  .sheconomy-livekit-room .lk-settings-toggle,
  .sheconomy-livekit-room .lk-disconnect-button,
  .sheconomy-livekit-room .lk-button-group-menu,
  .sheconomy-livekit-room .lk-video-conference {
    display: none !important;
  }
  .sheconomy-meeting-overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
`}

export function LiveKitMeetingRoom({
  meetingId,
  roomId,
  displayName,
  avatarUrl,
  enabled,
  mediaMode = 'meeting',
  initialAudio = true,
  initialVideo = true,
  onConnected,
  onDisconnected,
  overlay,
}: LiveKitMeetingRoomProps) {
  const { ui: coworkUi, gradients: coworkGradients, shadows: coworkShadows } = useCoWorkTheme()
  const [config, setConfig] = useState<LiveKitConfig | null>(null)
  const [credentials, setCredentials] = useState<Awaited<ReturnType<typeof fetchLiveKitCredentials>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!supportsLiveKitVideo() || !enabled) return
    void fetchLiveKitConfig().then(setConfig)
  }, [enabled])

  const loadCredentials = useCallback(async () => {
    if (!enabled || !roomId) return
    setLoading(true)
    setError(null)
    try {
      const liveKitConfig = await fetchLiveKitConfig()
      setConfig(liveKitConfig)
      if (!liveKitConfig.enabled) {
        throw new Error('Video meetings are temporarily unavailable. Please try again later.')
      }
      const creds = await fetchLiveKitCredentials(meetingId, roomId, displayName, avatarUrl)
      setCredentials(creds)
    } catch (loadError) {
      // Keep the in-room join UI — never treat a token fetch failure as a media
      // disconnect ("Unable to reconnect"). Parent can still show Retry here.
      setError(loadError instanceof Error ? loadError.message : 'Failed to connect to LiveKit')
    } finally {
      setLoading(false)
    }
  }, [avatarUrl, displayName, enabled, meetingId, roomId])

  useEffect(() => {
    void loadCredentials()
  }, [loadCredentials])

  if (!supportsLiveKitVideo()) {
    return (
      <ScreenFill padding="$5" alignItems="center" justifyContent="center" backgroundColor={coworkUi.pageBg}>
        <Text color={coworkUi.textSecondary} textAlign="center" lineHeight={22}>
          Allow camera and microphone access in your browser to join with video.
        </Text>
        {overlay?.(null)}
      </ScreenFill>
    )
  }

  if (!roomId) {
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg}>
        <Text color={coworkUi.danger}>Meeting room is not ready. Refresh and try again.</Text>
      </ScreenFill>
    )
  }

  if (config && !config.enabled) {
    return (
      <ScreenFill padding="$4" backgroundColor={coworkUi.pageBg} gap="$3">
        <Text color={coworkUi.danger} fontWeight="700">
          Co-Work video not configured
        </Text>
        <Text color={coworkUi.textSecondary} lineHeight={22}>
          Co-Work video is not available right now. Please try again later or contact support if this continues.
        </Text>
      </ScreenFill>
    )
  }

  if (error) {
    const friendlyError = /non-2xx|Edge Function/i.test(error)
      ? 'Could not join the video room. Check your connection and try again.'
      : error
    return (
      <ScreenFill
        padding="$4"
        backgroundColor={coworkUi.pageBg}
        gap="$3"
        position="relative"
        style={meetingViewportStyle()}
      >
        {overlay?.(null)}
        {/* Portal above meeting chrome — fixed overlay otherwise covers this card. */}
        <ViewportOverlay>
          <YStack
            position={'fixed' as never}
            top={0}
            left={0}
            right={0}
            bottom={0}
            alignItems="center"
            justifyContent="center"
            padding="$6"
            gap="$3"
            zIndex={200_000}
            pointerEvents="box-none"
            style={{ position: 'fixed', inset: 0, zIndex: 200_000 }}
          >
            <YStack
              maxWidth={420}
              width="100%"
              gap="$3"
              padding="$5"
              borderRadius={coworkUi.radius.panel}
              backgroundColor={coworkUi.surface}
              borderWidth={1}
              borderColor={coworkUi.glassBorder}
              pointerEvents="auto"
              style={coworkBoxShadow(coworkShadows, 'panel')}
            >
              <Text color={coworkUi.danger} fontWeight="800" fontSize={18}>
                Could not join video room
              </Text>
              <Text color={coworkUi.textSecondary} lineHeight={22}>
                {friendlyError}
              </Text>
              <Button tone="primary" borderRadius={999} onPress={() => void loadCredentials()}>
                Try again
              </Button>
            </YStack>
          </YStack>
        </ViewportOverlay>
      </ScreenFill>
    )
  }

  if (loading || !credentials) {
    return (
      <ScreenCenter backgroundColor={coworkUi.pageBg}>
        <Spinner size="large" color={coworkUi.brand} />
        <Text color={coworkUi.textSecondary} marginTop="$3">
          Joining Co-Work room…
        </Text>
      </ScreenCenter>
    )
  }

  return (
    <ScreenFill
      backgroundColor={coworkUi.pageBg}
      position="relative"
      style={{ ...meetingViewportStyle(), ...pageGradientStyle(coworkGradients.page, coworkUi.pageBg) }}
    >
      <LiveKitRoom
        serverUrl={credentials.serverUrl}
        token={credentials.token}
        connect
        audio={initialAudio}
        video={mediaMode !== 'audio' && initialVideo}
        options={getLiveKitRoomOptions('web')}
        onConnected={onConnected}
        onDisconnected={(reason) => {
          // User/leave/unmount initiated — do not escalate to "Unable to reconnect".
          if (reason === DisconnectReason.CLIENT_INITIATED) return
          onDisconnected()
        }}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <WebLiveKitMeetingContent
          overlay={overlay}
          mediaMode={mediaMode}
          avatarUrl={avatarUrl}
          initialAudio={initialAudio}
        />
      </LiveKitRoom>
      <style>{getSheconomyLivekitCss(coworkUi, coworkShadows)}</style>
    </ScreenFill>
  )
}

/**
 * Browsers block audio element playback until the page gets a user gesture
 * (autoplay policy). LiveKit reports this via `canPlaybackAudio`; remote
 * participants stay silent until `room.startAudio()` runs inside a gesture.
 * This hits hosts hardest: they land in the room via navigation (start
 * meeting / call accepted) without clicking anything on the meeting page.
 */
function useWebAudioPlaybackUnlock(room: Room | undefined) {
  const [audioBlocked, setAudioBlocked] = useState(false)

  const unlockAudio = useCallback(() => {
    if (!room) return
    void room.startAudio().catch(() => {
      // Still blocked — the banner stays visible for another explicit tap.
    })
  }, [room])

  useEffect(() => {
    if (!room) return

    const syncPlaybackStatus = () => setAudioBlocked(!room.canPlaybackAudio)

    // Best-effort unlock on connect and whenever a remote audio track arrives.
    // If the browser still blocks, the banner stays until a user gesture.
    const tryStart = () => {
      void room.startAudio().catch(() => {})
      syncPlaybackStatus()
    }

    const onTrackSubscribed = (track: { kind?: string }) => {
      if (track.kind === Track.Kind.Audio) tryStart()
    }

    room.on(RoomEvent.AudioPlaybackStatusChanged, syncPlaybackStatus)
    room.on(RoomEvent.Connected, tryStart)
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed as never)
    syncPlaybackStatus()
    if (room.state === ConnectionState.Connected) tryStart()

    return () => {
      room.off(RoomEvent.AudioPlaybackStatusChanged, syncPlaybackStatus)
      room.off(RoomEvent.Connected, tryStart)
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed as never)
    }
  }, [room])

  // Any interaction anywhere on the page counts as the unlocking gesture.
  useEffect(() => {
    if (!audioBlocked || typeof document === 'undefined') return
    const handler = () => unlockAudio()
    document.addEventListener('pointerdown', handler, { capture: true })
    document.addEventListener('keydown', handler, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', handler, { capture: true })
      document.removeEventListener('keydown', handler, { capture: true })
    }
  }, [audioBlocked, unlockAudio])

  return { audioBlocked, unlockAudio }
}

function WebLiveKitMeetingContent({
  overlay,
  mediaMode = 'meeting',
  avatarUrl,
  initialAudio = true,
}: {
  overlay?: (liveKit: LiveKitMediaControls | null) => React.ReactNode
  mediaMode?: import('~/co-work/lib/livekit-media-controls').LiveKitMediaMode
  avatarUrl?: string | null
  initialAudio?: boolean
}) {
  const liveKit = useLiveKitMediaControls(mediaMode !== 'audio')
  const { audioBlocked, unlockAudio } = useWebAudioPlaybackUnlock(liveKit.room)
  const micForcedRef = useRef(false)
  const { hasScreenShare } = useMeetingGalleryTracks()
  const viewingScreenShare = hasScreenShare && !liveKit.screenSharing

  const onForegroundAudio = useCallback(async () => {
    if (liveKit.room.state === ConnectionState.Connected) {
      await liveKit.room.startAudio().catch(() => {})
    }
  }, [liveKit.room])

  const { notice: lifecycleNotice } = useMeetingLifecycle({
    room: liveKit.room,
    mediaMode,
    screenSharing: liveKit.screenSharing,
    viewingScreenShare,
    cameraEnabled: liveKit.videoEnabled,
    onForegroundAudio,
  })

  useEffect(() => {
    const room = liveKit.room
    if (!room) return

    const unbindScreenShare = bindRemoteScreenShareQuality(room)

    const syncAvatarMetadata = async () => {
      if (!avatarUrl) return
      try {
        await room.localParticipant.setMetadata(buildParticipantMetadata({ avatarUrl }))
      } catch {
        // Metadata sync is best-effort; token metadata usually already has the avatar.
      }
    }

    const onConnected = () => {
      // Honor pre-join mute — never force-enable mic when the user joined muted.
      const forceMic = !micForcedRef.current && initialAudio
      micForcedRef.current = true
      void reinforceCallMediaOnConnect(room, mediaMode, { forceMicEnable: forceMic })
      void syncAvatarMetadata()
      void room.startAudio().catch(() => {})
    }

    room.on(RoomEvent.Connected, onConnected)
    if (room.state === ConnectionState.Connected) {
      onConnected()
    }

    return () => {
      room.off(RoomEvent.Connected, onConnected)
      unbindScreenShare()
    }
  }, [avatarUrl, initialAudio, liveKit.room, mediaMode])

  return (
    <YStack flex={1} width="100%" height="100%" position="relative" style={{ minHeight: 0, overflow: 'hidden' }}>
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        className="sheconomy-livekit-room"
        pointerEvents="none"
      >
        {mediaMode === 'audio' ? null : <MeetingVideoStage />}
        <RoomAudioRenderer />
      </YStack>
      <MeetingLifecycleBanner notice={lifecycleNotice} topOffset={80} />
      {audioBlocked ? (
        <XStack
          position="absolute"
          top={16}
          alignSelf="center"
          zIndex={300}
          alignItems="center"
          gap="$2"
          paddingVertical="$2"
          paddingHorizontal="$4"
          borderRadius={999}
          backgroundColor="rgba(12, 8, 10, 0.9)"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.25)"
          cursor="pointer"
          pointerEvents="auto"
          onPress={unlockAudio}
          role="button"
          aria-label="Enable meeting audio"
        >
          <Icons.Volume2 size={16} color="#fff" />
          <Text fontSize={13} fontWeight="700" color="#fff">
            Tap to enable audio
          </Text>
        </XStack>
      ) : null}
      <YStack
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        className="sheconomy-meeting-overlay"
        pointerEvents="box-none"
      >
        {overlay?.(liveKit)}
      </YStack>
    </YStack>
  )
}
