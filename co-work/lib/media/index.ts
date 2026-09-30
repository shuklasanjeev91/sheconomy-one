import {
  getRuntimePlatform,
  hasDisplayMedia,
  hasMediaRecorder,
  isNativeRuntime,
  supportsMeetingVideo,
} from '~/lib/platform/capabilities'

import type { MediaCapabilities } from '~/co-work/lib/types'

export function getMediaCapabilities(): MediaCapabilities {
  const platform = getRuntimePlatform()
  const meetingVideo = supportsMeetingVideo()

  return {
    platform,
    supportsVideo: meetingVideo,
    // Production meetings use the mediasoup SFU (getDisplayMedia / native broadcast).
    // iOS: ReplayKit. Android: MediaProjection from store build 182+.
    supportsScreenShare: hasDisplayMedia() || platform === 'ios' || platform === 'android',
    supportsRecording: hasMediaRecorder() || isNativeRuntime(),
    // Viewing shared captions is always available; publishing still needs STT.
    supportsLiveCaptions: true,
  }
}

export type MediaSessionCallbacks = {
  onRemoteStream: (peerId: string, stream: MediaStream) => void
  onRemoteScreenStream: (peerId: string, stream: MediaStream | null) => void
  onPeerDisconnected: (peerId: string) => void
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

/**
 * Legacy web peer-to-peer media session.
 *
 * @deprecated Production Co-Work meetings use an SFU (`createSfuMeetingMediaAdapter`).
 * Do NOT use this mesh for large meetings — O(n²) peer connections will not scale.
 * `createMediaSession` returns null so callers cannot accidentally enable mesh.
 */
export class WebMediaSession {
  private localStream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private peers = new Map<string, RTCPeerConnection>()
  private callbacks: MediaSessionCallbacks
  private sendSignal: (payload: import('~/co-work/lib/types').SignalPayload) => void
  private selfId: string
  private audioEnabled = true
  private videoEnabled = true

  constructor(
    selfId: string,
    sendSignal: (payload: import('~/co-work/lib/types').SignalPayload) => void,
    callbacks: MediaSessionCallbacks,
  ) {
    this.selfId = selfId
    this.sendSignal = sendSignal
    this.callbacks = callbacks
  }

  async startLocalMedia(video = true, audio = true): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null

    this.localStream = await navigator.mediaDevices.getUserMedia({
      video: video ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
    })
    this.audioEnabled = audio
    this.videoEnabled = video
    return this.localStream
  }

  getLocalStream() {
    return this.localStream
  }

  getScreenStream() {
    return this.screenStream
  }

  isAudioEnabled() {
    return this.audioEnabled
  }

  isVideoEnabled() {
    return this.videoEnabled
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = this.audioEnabled
    })
    this.broadcastPresence(false)
    return this.audioEnabled
  }

  toggleVideo() {
    this.videoEnabled = !this.videoEnabled
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = this.videoEnabled
    })
    this.broadcastPresence(false)
    return this.videoEnabled
  }

  async startScreenShare(): Promise<MediaStream | null> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return null
    this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    this.screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      void this.stopScreenShare()
    })
    this.broadcastPresence(true)
    return this.screenStream
  }

  async stopScreenShare() {
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.screenStream = null
    this.broadcastPresence(false)
  }

  broadcastPresence(screen: boolean) {
    this.sendSignal({
      type: 'presence',
      from: this.selfId,
      audio: this.audioEnabled,
      video: this.videoEnabled,
      screen,
      hand: false,
    })
  }

  async connectToPeer(peerId: string, initiator: boolean) {
    if (this.peers.has(peerId) || peerId === this.selfId) return

    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.peers.set(peerId, peer)

    this.localStream?.getTracks().forEach((track) => {
      if (this.localStream) peer.addTrack(track, this.localStream)
    })

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'ice',
          from: this.selfId,
          to: peerId,
          candidate: event.candidate.toJSON(),
        })
      }
    }

    peer.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) this.callbacks.onRemoteStream(peerId, stream)
    }

    peer.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) {
        this.removePeer(peerId)
      }
    }

    if (initiator) {
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      this.sendSignal({ type: 'offer', from: this.selfId, to: peerId, sdp: offer.sdp ?? '' })
    }
  }

  async handleSignal(payload: import('~/co-work/lib/types').SignalPayload) {
    if (payload.type === 'offer' && payload.to === this.selfId) {
      await this.connectToPeer(payload.from, false)
      const peer = this.peers.get(payload.from)
      if (!peer) return
      await peer.setRemoteDescription({ type: 'offer', sdp: payload.sdp })
      const answer = await peer.createAnswer()
      await peer.setLocalDescription(answer)
      this.sendSignal({ type: 'answer', from: this.selfId, to: payload.from, sdp: answer.sdp ?? '' })
      return
    }

    if (payload.type === 'answer' && payload.to === this.selfId) {
      const peer = this.peers.get(payload.from)
      if (!peer) return
      await peer.setRemoteDescription({ type: 'answer', sdp: payload.sdp })
      return
    }

    if (payload.type === 'ice' && payload.to === this.selfId) {
      const peer = this.peers.get(payload.from)
      if (!peer || !payload.candidate) return
      await peer.addIceCandidate(payload.candidate)
      return
    }

    if (payload.type === 'kick' && payload.to === this.selfId) {
      await this.destroy()
    }
  }

  removePeer(peerId: string) {
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.close()
      this.peers.delete(peerId)
    }
    this.callbacks.onPeerDisconnected(peerId)
  }

  async destroy() {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId)
    }
    this.localStream?.getTracks().forEach((t) => t.stop())
    this.screenStream?.getTracks().forEach((t) => t.stop())
    this.localStream = null
    this.screenStream = null
  }
}

/**
 * Mesh media is disabled for Co-Work meetings.
 * Production path: mediasoup SFU via `~/co-work/lib/realtime`.
 */
export function createMediaSession(
  _selfId: string,
  _sendSignal: (payload: import('~/co-work/lib/types').SignalPayload) => void,
  _callbacks: MediaSessionCallbacks,
): WebMediaSession | null {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      '[co-work] createMediaSession (P2P mesh) is disabled. Use the SFU MeetingMediaAdapter.',
    )
  }
  return null
}
