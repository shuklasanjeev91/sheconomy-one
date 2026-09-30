import { useCallback, useEffect, useMemo, useState } from 'react'

import { MeetingProvider, useMeetingMachine } from '~/co-work/components/MeetingProvider'
import {
  MeetingLiveSignalsProvider,
  useMeetingLiveSignals,
} from '~/co-work/components/MeetingLiveSignalsContext'
import { MeetingVideoStageView } from '~/co-work/components/MeetingVideoStage'
import { MediasoupParticipantTile } from '~/co-work/components/MediasoupParticipantTile.web'
import { getMeetingStageCss } from '~/co-work/components/meeting-stage-css'
import { useMediasoupGalleryTracks } from '~/co-work/hooks/useMediasoupGalleryTracks'
import type { MeetingVideoQuality } from '~/co-work/lib/meeting-selective-subscribe'
import { mediasoupTrackKey, type MediasoupTrackRef } from '~/co-work/lib/mediasoup/mediasoup-stage-tracks'
import { useCoWorkTheme } from '~/co-work/lib/theme'

const FAKE_PARTICIPANTS = 30

function FakeOverlay({
  onAddParticipant,
  onToggleShare,
}: {
  onAddParticipant: () => void
  onToggleShare: () => void
}) {
  const { stageHandlesTaps, setStageTapHandler, setSafeDrivingHandler } = useMeetingLiveSignals()
  const { state, dispatch } = useMeetingMachine()
  const [taps, setTaps] = useState(0)
  const [driving, setDriving] = useState(0)
  useEffect(() => {
    setStageTapHandler(() => setTaps((count) => count + 1))
    return () => setStageTapHandler(null)
  }, [setStageTapHandler])
  useEffect(() => {
    setSafeDrivingHandler(() => setDriving((count) => count + 1))
    return () => setSafeDrivingHandler(null)
  }, [setSafeDrivingHandler])
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'none' }}>
      {!stageHandlesTaps ? (
        <div
          id="legacy-catcher"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
          onClick={() => setTaps((count) => count + 1)}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          display: 'flex',
          gap: 8,
          pointerEvents: 'auto',
          color: '#fff',
          fontSize: 12,
        }}
      >
        <span id="tap-count">taps:{taps}</span>
        <span id="handles">stageHandlesTaps:{String(stageHandlesTaps)}</span>
        <span id="view">{state.viewMode}</span>
        <span id="driving">driving:{driving}</span>
        <button id="add-participant" onClick={onAddParticipant}>
          Join
        </button>
        <button id="toggle-share" onClick={onToggleShare}>
          Share
        </button>
        <button id="view-gallery" onClick={() => dispatch({ type: 'SET_VIEW', viewMode: 'gallery' })}>
          Gallery
        </button>
        <button id="view-speaker" onClick={() => dispatch({ type: 'SET_VIEW', viewMode: 'speaker' })}>
          Speaker
        </button>
      </div>
    </div>
  )
}

function fakeTrackRefs(count: number): MediasoupTrackRef[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1
    return {
      source: 'camera',
      consumerId: null,
      participant: {
        identity: `user-${n}`,
        peerId: `user-${n}~dev`,
        name: `Person ${n}`,
        avatarUrl: null,
        isLocal: false,
        isSpeaking: false,
        isCameraEnabled: false,
        isMicrophoneEnabled: false,
      },
    }
  })
}

function fakeLocalScreen(): MediasoupTrackRef {
  return {
    source: 'screen_share',
    consumerId: null,
    publication: { source: 'screen_share', isMuted: false, track: null as unknown as MediaStreamTrack },
    participant: { ...fakeTrackRefs(1)[0]!.participant, isLocal: true },
  }
}

function FakeStage({
  count,
  sharing,
  onStopShare,
}: {
  count: number
  sharing: boolean
  onStopShare: () => void
}) {
  const trackRefs = useMemo(
    () => [...fakeTrackRefs(count), ...(sharing ? [fakeLocalScreen()] : [])],
    [count, sharing],
  )
  const gallery = useMediasoupGalleryTracks({ trackRefs, localUserId: 'user-1', activeSpeakerIdentity: null })
  const renderTiles = useCallback(
    (tracks: MediasoupTrackRef[], cameraQuality: MeetingVideoQuality) =>
      tracks.map((track) => (
        <MediasoupParticipantTile
          key={mediasoupTrackKey(track)}
          trackRef={track}
          mirrorLocalVideo={false}
          cameraQuality={cameraQuality}
          onPreferredLayer={() => {}}
        />
      )),
    [],
  )
  return (
    <MeetingVideoStageView
      gallery={gallery}
      renderTiles={renderTiles}
      onVisibleIdentities={() => {}}
      onStopScreenShare={onStopShare}
    />
  )
}

export default function DevStageScrollRoute() {
  const { ui, shadows } = useCoWorkTheme()
  const [count, setCount] = useState(FAKE_PARTICIPANTS)
  const [sharing, setSharing] = useState(false)
  return (
    <MeetingProvider>
      <MeetingLiveSignalsProvider localUserId="" handRaised={false} raisedHands={{}}>
        <div style={{ position: 'fixed', inset: 0, background: '#0c080a' }}>
          <div className="sheconomy-media-room">
            <FakeStage count={count} sharing={sharing} onStopShare={() => setSharing(false)} />
          </div>
          <FakeOverlay
            onAddParticipant={() => setCount((value) => value + 1)}
            onToggleShare={() => setSharing((value) => !value)}
          />
        </div>
        <style>{getMeetingStageCss(ui, shadows)}</style>
      </MeetingLiveSignalsProvider>
    </MeetingProvider>
  )
}
