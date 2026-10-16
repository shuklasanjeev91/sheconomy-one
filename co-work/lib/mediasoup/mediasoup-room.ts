// mediasoup-client is CommonJS and must stay out of SSR: it is imported on join only.
import type {
  BuiltinHandlerName,
  Consumer,
  Device,
  Producer,
  RtpCapabilities,
  RtpEncodingParameters,
  RtpParameters,
  Transport,
} from 'mediasoup-client/types'

import {
  interpretationChannelFromSource,
  interpretationConsumersToPause,
} from '~/co-work/lib/meeting-interpretation'
import { mediasoupPeerUserId } from '~/co-work/lib/mediasoup/peer-identity'
import { ProtooPeer, type ProtooWebSocketFactory } from '~/co-work/lib/mediasoup/protoo'

export type MediasoupConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'closed'

export type CameraFacing = 'user' | 'environment'

/** What a producer carries — matches the mediasoup-demo `appData.source` values. */
export type MediasoupSource = 'audio' | 'video' | 'screensharing' | 'screenaudio' | 'interpretation'

export type MediasoupRemoteTrack = {
  consumerId: string
  track: MediaStreamTrack
  /** The sender paused it (muted mic). */
  producerPaused: boolean
  /** Set when `source` is `interpretation:<channel>`. */
  channelId?: string | null
}

export type MediasoupRemotePeer = {
  peerId: string
  userId: string
  displayName: string
  avatarUrl: string | null
  audio: MediasoupRemoteTrack | null
  video: MediasoupRemoteTrack | null
  screen: MediasoupRemoteTrack | null
  /** Computer sound shared with the screen. */
  screenAudio: MediasoupRemoteTrack | null
  /** Interpreter microphone for one language channel. */
  interpretation: MediasoupRemoteTrack | null
}

export type MediasoupLocalState = {
  micEnabled: boolean
  micTrack: MediaStreamTrack | null
  cameraEnabled: boolean
  /** What is sent (processed when a background effect is on). */
  cameraTrack: MediaStreamTrack | null
  /** Captured camera before processing. */
  cameraRawTrack: MediaStreamTrack | null
  cameraFacing: CameraFacing
  screenSharing: boolean
  screenTrack: MediaStreamTrack | null
}

export type MediasoupRoomSnapshot = {
  connection: MediasoupConnectionState
  error: string | null
  /** The host removed this peer from the media server. */
  removed: boolean
  peers: MediasoupRemotePeer[]
  local: MediasoupLocalState
  activeSpeakerPeerId: string | null
  speakingPeerIds: string[]
}

/** Swaps the outgoing camera for a processed copy (virtual backgrounds). */
export type CameraTrackProcessor = {
  /** Track to send in place of `raw`; may be `raw` itself. Called again after each camera restart. */
  start(raw: MediaStreamTrack): Promise<MediaStreamTrack>
  /** Tear down whatever `start` created; never stops `raw`. */
  stop(): void
}

export type MediasoupMediaDevices = {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
  getDisplayMedia(constraints?: DisplayMediaStreamOptions): Promise<MediaStream>
}

export type MediasoupRoomOptions = {
  /** Signalling base URL, e.g. `wss://media.example.com:4443`. */
  url: string
  roomId: string
  peerId: string
  token: string
  displayName: string
  avatarUrl?: string | null
  /** `ReactNative106` on iOS/Android; browsers auto-detect. */
  handlerName?: BuiltinHandlerName
  mediaDevices: () => MediasoupMediaDevices
  createWebSocket?: ProtooWebSocketFactory
  /** Send camera as three simulcast layers (off for audio-only calls). */
  simulcast?: boolean
}

type TransportInfo = {
  transportId?: string
  id?: string
  iceParameters: Parameters<Device['createSendTransport']>[0]['iceParameters']
  iceCandidates: Parameters<Device['createSendTransport']>[0]['iceCandidates']
  dtlsParameters: Parameters<Device['createSendTransport']>[0]['dtlsParameters']
}

type NewConsumerRequest = {
  peerId: string
  producerId: string
  consumerId?: string
  id?: string
  kind: 'audio' | 'video'
  rtpParameters: RtpParameters
  producerPaused?: boolean
  appData?: { source?: string }
}

type SerializedPeer = {
  peerId?: string
  id?: string
  displayName?: string
  device?: { avatarUrl?: unknown } | null
}

type ConsumerAppData = { peerId: string; source: MediasoupSource }

export const MEDIASOUP_RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000] as const

const CAMERA_SIMULCAST_ENCODINGS: RtpEncodingParameters[] = [
  { scaleResolutionDownBy: 4, maxBitrate: 150_000, scalabilityMode: 'L1T3' },
  { scaleResolutionDownBy: 2, maxBitrate: 500_000, scalabilityMode: 'L1T3' },
  { scaleResolutionDownBy: 1, maxBitrate: 1_200_000, scalabilityMode: 'L1T3' },
]
const CAMERA_SINGLE_ENCODING: RtpEncodingParameters[] = [{ maxBitrate: 900_000 }]
const SCREEN_ENCODINGS: RtpEncodingParameters[] = [{ maxBitrate: 1_500_000 }]

export function mediasoupSourceOf(appData: { source?: string } | undefined): MediasoupSource {
  const source = appData?.source
  if (source === 'screensharing' || source === 'share') return 'screensharing'
  if (source === 'screenaudio') return 'screenaudio'
  if (source === 'interpretation' || source?.startsWith('interpretation:')) return 'interpretation'
  if (source === 'audio' || source === 'mic') return 'audio'
  return 'video'
}

export function mediasoupSignallingUrl(
  baseUrl: string,
  params: { roomId: string; peerId: string; token: string },
): string {
  const query = new URLSearchParams({
    roomId: params.roomId,
    peerId: params.peerId,
    token: params.token,
  })
  return `${baseUrl.replace(/\/+$/, '')}/?${query.toString()}`
}

function peerAvatar(peer: SerializedPeer): string | null {
  const url = peer.device?.avatarUrl
  return typeof url === 'string' && url.trim() ? url.trim() : null
}

function stopTrack(track: MediaStreamTrack | null | undefined) {
  try {
    track?.stop()
  } catch {
    // Already stopped.
  }
}

function trackIsLive(track: MediaStreamTrack | null | undefined): boolean {
  return !!track && track.readyState !== 'ended'
}

export class MediasoupRoom {
  private readonly options: MediasoupRoomOptions
  private readonly listeners = new Set<() => void>()
  private protoo: ProtooPeer | null = null
  private device: Device | null = null
  private sendTransport: Transport | null = null
  private recvTransport: Transport | null = null
  private micProducer: Producer | null = null
  private cameraProducer: Producer | null = null
  private screenProducer: Producer | null = null
  private screenAudioProducer: Producer | null = null
  private interpretationProducer: Producer | null = null
  /** Language this peer is interpreting. Floor mic stays paused while set. */
  private interpretingChannel: string | null = null
  private listenChannel = 'floor'
  private hearFloor = true
  private readonly consumers = new Map<string, Consumer>()
  private readonly locallyPausedConsumers = new Set<string>()
  private readonly preferredLayers = new Map<string, number>()
  private consumerQueue: Promise<unknown> = Promise.resolve()
  private peers = new Map<string, MediasoupRemotePeer>()
  private snapshot: MediasoupRoomSnapshot
  private emitScheduled = false
  private closed = false
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private visibleUserIds: Set<string> | null = null
  /** What the user asked for, restored after a reconnect. */
  private wantMic = false
  private wantCamera = false
  private micConstraints: MediaTrackConstraints | boolean = true
  private cameraProcessor: CameraTrackProcessor | null = null
  /** Captured camera before processing; `cameraProducer.track` is what is sent. */
  private rawCameraTrack: MediaStreamTrack | null = null
  private micTrackReplacementInProgress = false
  private cameraTrackReplacementInProgress = false
  private cameraTrackReplacement: Promise<void> | null = null

  constructor(options: MediasoupRoomOptions) {
    this.options = { ...options }
    this.snapshot = {
      connection: 'connecting',
      error: null,
      removed: false,
      peers: [],
      local: {
        micEnabled: false,
        micTrack: null,
        cameraEnabled: false,
        cameraTrack: null,
        cameraRawTrack: null,
        cameraFacing: 'user',
        screenSharing: false,
        screenTrack: null,
      },
      activeSpeakerPeerId: null,
      speakingPeerIds: [],
    }
  }

  get peerId(): string {
    return this.options.peerId
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): MediasoupRoomSnapshot => this.snapshot

  /** Connect, join and publish the requested media. Resolves once joined. */
  async join(initial: { audio: boolean; video: boolean; audioConstraints?: MediaTrackConstraints }) {
    this.wantMic = initial.audio
    this.wantCamera = initial.video
    if (initial.audioConstraints) this.micConstraints = initial.audioConstraints
    await this.connect().catch((error) => {
      if (this.closed) return
      this.reportError(error)
      this.teardownMedia()
      this.dropSignalling()
      this.scheduleReconnect()
    })
  }

  close() {
    if (this.closed) return
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.teardownMedia()
    this.dropSignalling()
    this.update({ connection: 'closed' })
  }

  /** Rename without rejoining; reconnects reuse the new name. */
  async setDisplayName(displayName: string) {
    const name = displayName.trim()
    if (!name || name === this.options.displayName) return
    this.options.displayName = name
    this.signal('changeDisplayName', { displayName: name })
  }

  /** Manual retry after `failed`. */
  async reconnect() {
    if (this.closed) return
    this.reconnectAttempt = 0
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.teardownMedia()
    this.dropSignalling()
    this.update({ connection: 'reconnecting', error: null })
    await this.connect().catch(() => {
      this.teardownMedia()
      this.dropSignalling()
      this.scheduleReconnect()
    })
  }

  async setMicEnabled(enabled: boolean, constraints?: MediaTrackConstraints) {
    if (constraints) this.micConstraints = constraints
    this.wantMic = enabled
    if (this.interpretingChannel) {
      this.pauseFloorProducer()
      if (!this.interpretationProducer) {
        await this.ensureInterpretationProducer(this.interpretingChannel)
      }
      this.syncInterpretationMute()
      this.updateLocal()
      return
    }
    const producer = this.micProducer
    if (!enabled) {
      if (producer && !producer.paused) {
        producer.pause()
        this.signal('pauseProducer', { producerId: producer.id })
      }
      this.updateLocal()
      return
    }
    if (producer) {
      if (!trackIsLive(producer.track)) {
        await this.replaceMicTrack(producer, this.micConstraints)
      }
      if (!this.wantMic || this.micProducer !== producer) return
      if (!trackIsLive(producer.track)) {
        throw new Error('The microphone stopped. Check microphone access, then try unmuting again.')
      }
      if (producer.paused) {
        producer.resume()
        this.signal('resumeProducer', { producerId: producer.id })
      }
      this.updateLocal()
      return
    }
    await this.produceMic()
  }

  /**
   * Interpreter mic. `null` / `floor` closes that producer and restores the floor mic.
   * The floor producer stays paused so the translation is not heard on the original channel.
   */
  async publishInterpretation(channelId: string | null): Promise<void> {
    const next = interpretationChannelFromSource(
      channelId && channelId !== 'floor' ? `interpretation:${channelId}` : undefined,
    )
    if (!this.sendTransport) {
      this.interpretingChannel = next
      return
    }
    if (next === this.interpretingChannel) {
      if (next && this.interpretationProducer) return
      if (!next && !this.interpretationProducer) return
    }
    if (!next) {
      this.interpretingChannel = null
      this.closeInterpretationProducer()
      if (this.wantMic) {
        const producer = this.micProducer
        if (producer?.paused && trackIsLive(producer.track)) {
          producer.resume()
          this.signal('resumeProducer', { producerId: producer.id })
        } else if (!producer) {
          await this.produceMic()
        }
      }
      this.updateLocal()
      return
    }
    this.interpretingChannel = next
    this.pauseFloorProducer()
    await this.ensureInterpretationProducer(next)
    this.syncInterpretationMute()
    this.updateLocal()
  }

  /** Local listen mix. Interpreters pass `hearFloor: true` so they still hear the original room. */
  setInterpretationPlayback(input: { listenChannel: string; hearFloor: boolean }) {
    this.listenChannel = input.listenChannel || 'floor'
    this.hearFloor = input.hearFloor || this.listenChannel === 'floor'
    this.applyInterpretationMix()
  }

  /** Recapture the microphone with new constraints (e.g. Original Sound). */
  async restartMic(constraints: MediaTrackConstraints) {
    this.micConstraints = constraints
    if (this.interpretingChannel) {
      const floor = this.micProducer
      if (floor) await this.replaceMicTrack(floor, constraints)
      this.closeInterpretationProducer()
      await this.ensureInterpretationProducer(this.interpretingChannel)
      this.pauseFloorProducer()
      this.syncInterpretationMute()
      this.updateLocal()
      return
    }
    const producer = this.micProducer
    if (!producer || producer.paused) return
    await this.replaceMicTrack(producer, constraints)
  }

  async setCameraEnabled(enabled: boolean, options?: { facingMode?: CameraFacing; deviceId?: string }) {
    this.wantCamera = enabled
    if (!enabled) {
      this.closeProducer('camera')
      return
    }
    if (options?.facingMode) this.update({ local: { ...this.snapshot.local, cameraFacing: options.facingMode } })
    if (this.cameraProducer && !options?.deviceId) {
      if (trackIsLive(this.cameraProducer.track) && trackIsLive(this.rawCameraTrack)) return
      await this.replaceCameraTrack({ facingMode: options?.facingMode ?? this.snapshot.local.cameraFacing })
      return
    }
    if (this.cameraProducer && options?.deviceId) {
      await this.replaceCameraTrack({ deviceId: { exact: options.deviceId } })
      return
    }
    await this.produceCamera(options?.deviceId ? { deviceId: { exact: options.deviceId } } : undefined)
  }

  /** Front ↔ rear. Native flips in place; browsers recapture and swap the track. */
  async flipCamera(native: boolean): Promise<CameraFacing> {
    const next: CameraFacing = this.snapshot.local.cameraFacing === 'user' ? 'environment' : 'user'
    const raw = this.rawCameraTrack
    if (!this.cameraProducer || !raw) {
      await this.setCameraEnabled(true, { facingMode: next })
      return next
    }
    const track = raw as MediaStreamTrack & { _switchCamera?: () => void }
    if (native) {
      try {
        await track.applyConstraints({ facingMode: { exact: next } as unknown as ConstrainDOMString })
      } catch {
        if (typeof track._switchCamera === 'function') track._switchCamera()
        else throw new Error('Could not switch camera.')
      }
      this.update({ local: { ...this.snapshot.local, cameraFacing: next } })
      return next
    }
    await this.replaceCameraTrack({ facingMode: next })
    this.update({ local: { ...this.snapshot.local, cameraFacing: next } })
    return next
  }

  async setScreenShareEnabled(
    enabled: boolean,
    options?: { audio?: boolean; contentHint?: string; constraints?: DisplayMediaStreamOptions },
  ) {
    if (!enabled) {
      this.closeProducer('screen')
      return
    }
    if (this.screenProducer) return
    const transport = this.requireSendTransport()
    const stream = await this.options.mediaDevices().getDisplayMedia(
      options?.constraints ?? { video: true, audio: options?.audio === true },
    )
    const track = stream.getVideoTracks()[0]
    const [audioTrack, ...extraAudio] = options?.audio ? stream.getAudioTracks() : []
    for (const extra of options?.audio ? extraAudio : stream.getAudioTracks()) stopTrack(extra)
    if (!track) {
      stopTrack(audioTrack)
      throw new Error('Screen capture did not start. Choose a screen and try again.')
    }
    if (this.screenProducer || this.closed) {
      stopTrack(track)
      stopTrack(audioTrack)
      return
    }
    if (options?.contentHint) {
      try {
        track.contentHint = options.contentHint
      } catch {
        // Not supported on this platform.
      }
    }
    const producer = await transport.produce({
      track,
      encodings: SCREEN_ENCODINGS,
      codecOptions: { videoGoogleStartBitrate: 1000 },
      appData: { source: 'screensharing' },
    })
    this.screenProducer = producer
    track.addEventListener?.('ended', () => this.closeProducer('screen'))
    producer.on('trackended', () => this.closeProducer('screen'))
    if (audioTrack) {
      try {
        this.screenAudioProducer = await transport.produce({
          track: audioTrack,
          appData: { source: 'screenaudio' },
        })
      } catch {
        // The screen still shares without sound.
        stopTrack(audioTrack)
      }
    }
    this.updateLocal()
  }

  /**
   * Pause video from anyone off screen (gallery pages, filmstrip) so bandwidth
   * scales with what is visible. `null` resumes everyone.
   */
  setVisibleUserIds(userIds: Set<string> | null) {
    this.visibleUserIds = userIds
    this.applyVisibility()
  }

  /** Simulcast layer for a remote camera: 0 = low, 2 = high. */
  setPreferredVideoLayer(userId: string, spatialLayer: number) {
    for (const peer of this.peers.values()) {
      if (peer.userId !== userId || !peer.video) continue
      const consumerId = peer.video.consumerId
      if (this.preferredLayers.get(consumerId) === spatialLayer) continue
      this.preferredLayers.set(consumerId, spatialLayer)
      this.signal('setConsumerPreferredLayers', {
        consumerId,
        spatialLayer,
        temporalLayer: 2,
      })
    }
  }

  /**
   * Ask a presenter for a fresh frame. A static share sends nothing until its
   * content changes, so a newly attached view would otherwise stay black.
   */
  requestScreenKeyFrame(userId: string) {
    for (const peer of this.peers.values()) {
      if (peer.userId !== userId || !peer.screen) continue
      this.signal('requestConsumerKeyFrame', { consumerId: peer.screen.consumerId })
    }
  }

  /** Process the outgoing camera; `null` sends the raw camera again. */
  async setCameraProcessor(processor: CameraTrackProcessor | null) {
    const previous = this.cameraProcessor
    this.cameraProcessor = processor
    const producer = this.cameraProducer
    const raw = this.rawCameraTrack
    if (!producer || !raw) {
      if (previous && previous !== processor) previous.stop()
      return
    }
    const sent = producer.track
    const next = processor ? await processor.start(raw) : raw
    if (this.cameraProducer !== producer || this.rawCameraTrack !== raw) {
      if (next !== raw) processor?.stop()
      return
    }
    await producer.replaceTrack({ track: next })
    if (previous && previous !== processor) previous.stop()
    if (sent && sent !== raw && sent !== next) stopTrack(sent)
    this.updateLocal()
  }

  /** Current microphone level, 0…1 (0 while muted). */
  async getMicLevel(): Promise<number> {
    const producer = this.micProducer
    if (!producer || producer.paused) return 0
    try {
      const stats = await producer.getStats()
      let level = 0
      stats.forEach((report: { type?: string; kind?: string; audioLevel?: number }) => {
        if (report.type === 'media-source' && typeof report.audioLevel === 'number') {
          level = Math.max(level, report.audioLevel)
        }
      })
      return Math.min(1, Math.max(0, level))
    } catch {
      return 0
    }
  }

  // ── connection ──────────────────────────────────────────────────────────

  private async connect() {
    const { url, roomId, peerId, token } = this.options
    const protoo = new ProtooPeer(mediasoupSignallingUrl(url, { roomId, peerId, token }), {
      createWebSocket: this.options.createWebSocket,
    })
    this.protoo = protoo
    protoo.onRequest = (method, data) => this.handleRequest(method, data)
    protoo.onNotification = (method, data) => this.handleNotification(method, data)
    protoo.onClose = () => {
      if (this.closed || this.protoo !== protoo) return
      this.teardownMedia()
      this.scheduleReconnect()
    }

    await protoo.open
    if (this.closed || this.protoo !== protoo) return

    const device =
      this.device ??
      (await (await import('mediasoup-client')).Device.factory({ handlerName: this.options.handlerName }))
    if (!device.loaded) {
      const { routerRtpCapabilities } = await protoo.request<{
        routerRtpCapabilities: RtpCapabilities
      }>('getRouterRtpCapabilities')
      await device.load({ routerRtpCapabilities })
    }
    this.device = device

    this.sendTransport = await this.createTransport(protoo, device, 'send')
    this.recvTransport = await this.createTransport(protoo, device, 'recv')

    const { peers } = await protoo.request<{ peers?: SerializedPeer[] }>('join', {
      displayName: this.options.displayName,
      device: {
        flag: 'sheconomy',
        name: 'SHEconomy',
        version: '1',
        avatarUrl: this.options.avatarUrl ?? null,
      },
      rtpCapabilities: device.recvRtpCapabilities,
      sctpCapabilities: undefined,
    })
    for (const peer of peers ?? []) this.addPeer(peer)

    this.reconnectAttempt = 0
    this.update({ connection: 'connected', error: null })

    if (this.wantMic) await this.produceMic().catch((error) => this.reportError(error))
    if (this.interpretingChannel) {
      this.pauseFloorProducer()
      await this.ensureInterpretationProducer(this.interpretingChannel).catch((error) => this.reportError(error))
      this.syncInterpretationMute()
    }
    if (this.wantCamera) await this.produceCamera().catch((error) => this.reportError(error))
  }

  private scheduleReconnect() {
    if (this.closed) return
    const delay = MEDIASOUP_RECONNECT_DELAYS_MS[this.reconnectAttempt]
    if (delay === undefined) {
      this.update({ connection: 'failed', error: 'Lost connection to the meeting media server.' })
      return
    }
    this.reconnectAttempt += 1
    this.update({ connection: 'reconnecting' })
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.closed) return
      this.dropSignalling()
      void this.connect().catch(() => {
        this.teardownMedia()
        this.dropSignalling()
        this.scheduleReconnect()
      })
    }, delay)
  }

  private async createTransport(
    protoo: ProtooPeer,
    device: Device,
    direction: 'send' | 'recv',
  ): Promise<Transport> {
    const info = await protoo.request<TransportInfo>('createWebRtcTransport', {
      forceTcp: false,
      sctpCapabilities: undefined,
      appData: { direction: direction === 'send' ? 'producer' : 'consumer' },
    })
    const params = {
      id: info.transportId ?? info.id ?? '',
      iceParameters: info.iceParameters,
      iceCandidates: info.iceCandidates,
      dtlsParameters: { ...info.dtlsParameters, role: 'auto' as const },
      iceServers: [],
    }
    const transport =
      direction === 'send' ? device.createSendTransport(params) : device.createRecvTransport(params)

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      protoo
        .request('connectWebRtcTransport', { transportId: transport.id, dtlsParameters })
        .then(() => callback())
        .catch(errback)
    })
    if (direction === 'send') {
      transport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
        protoo
          .request<{ producerId?: string; id?: string }>('produce', {
            transportId: transport.id,
            kind,
            rtpParameters,
            appData,
          })
          .then(({ producerId, id }) => callback({ id: producerId ?? id ?? '' }))
          .catch(errback)
      })
    }
    transport.on('connectionstatechange', (state) => {
      if (state !== 'failed' || transport.closed) return
      void protoo
        .request<{ iceParameters: TransportInfo['iceParameters'] }>('restartIce', {
          transportId: transport.id,
        })
        .then(({ iceParameters }) => transport.restartIce({ iceParameters }))
        .catch(() => {})
    })
    return transport
  }

  private dropSignalling() {
    const protoo = this.protoo
    this.protoo = null
    protoo?.close()
  }

  /** Producers stop their tracks on close; a reconnect captures fresh ones. */
  private teardownMedia() {
    const producers = [
      this.micProducer,
      this.cameraProducer,
      this.screenProducer,
      this.screenAudioProducer,
      this.interpretationProducer,
    ]
    for (const producer of producers) {
      if (!producer) continue
      const track = producer.track
      try {
        producer.close()
      } catch {
        // Transport already gone.
      }
      stopTrack(track)
    }
    this.micProducer = null
    this.cameraProducer = null
    this.screenProducer = null
    this.screenAudioProducer = null
    this.interpretationProducer = null
    this.releaseRawCamera()
    for (const consumer of this.consumers.values()) {
      try {
        consumer.close()
      } catch {
        // Already closed.
      }
    }
    this.consumers.clear()
    this.locallyPausedConsumers.clear()
    this.preferredLayers.clear()
    for (const transport of [this.sendTransport, this.recvTransport]) {
      try {
        transport?.close()
      } catch {
        // Already closed.
      }
    }
    this.sendTransport = null
    this.recvTransport = null
    this.peers = new Map()
    this.update({ peers: [], activeSpeakerPeerId: null, speakingPeerIds: [] })
    this.updateLocal()
  }

  // ── local media ─────────────────────────────────────────────────────────

  private requireSendTransport(): Transport {
    if (!this.sendTransport) throw new Error('Meeting media is still connecting. Try again in a moment.')
    return this.sendTransport
  }

  private pauseFloorProducer() {
    const producer = this.micProducer
    if (!producer || producer.paused) return
    producer.pause()
    this.signal('pauseProducer', { producerId: producer.id })
  }

  private syncInterpretationMute() {
    const producer = this.interpretationProducer
    if (!producer || this.closed) return
    if (this.wantMic && producer.paused) {
      producer.resume()
      this.signal('resumeProducer', { producerId: producer.id })
      return
    }
    if (!this.wantMic && !producer.paused) {
      producer.pause()
      this.signal('pauseProducer', { producerId: producer.id })
    }
  }

  private closeInterpretationProducer() {
    const producer = this.interpretationProducer
    this.interpretationProducer = null
    if (!producer) return
    const track = producer.track
    try {
      producer.close()
    } catch {
      // Transport already gone.
    }
    stopTrack(track)
    this.signal('closeProducer', { producerId: producer.id })
  }

  private async ensureInterpretationProducer(channelId: string) {
    const source = `interpretation:${channelId}`
    const current = this.interpretationProducer
    const currentSource = (current?.appData as { source?: string } | undefined)?.source
    if (current && currentSource === source) return
    this.closeInterpretationProducer()
    const transport = this.requireSendTransport()
    let track: MediaStreamTrack | undefined
    const floor = this.micProducer?.track
    if (floor && trackIsLive(floor)) {
      track = floor.clone()
    } else {
      const stream = await this.options.mediaDevices().getUserMedia({ audio: this.micConstraints })
      track = stream.getAudioTracks()[0]
    }
    if (!track) throw new Error('No microphone found.')
    if (this.interpretingChannel !== channelId || this.closed) {
      stopTrack(track)
      return
    }
    this.interpretationProducer = await transport.produce({
      track,
      codecOptions: { opusStereo: false, opusDtx: true, opusFec: true },
      appData: { source },
    })
  }

  private applyInterpretationMix() {
    const slots = [...this.peers.values()].flatMap((peer) => {
      const rows: { consumerId: string; kind: 'floor' | 'interpretation'; channelId: string | null }[] = []
      if (peer.audio) rows.push({ consumerId: peer.audio.consumerId, kind: 'floor', channelId: null })
      if (peer.interpretation) {
        rows.push({
          consumerId: peer.interpretation.consumerId,
          kind: 'interpretation',
          channelId: peer.interpretation.channelId ?? null,
        })
      }
      return rows
    })
    const paused = new Set(
      interpretationConsumersToPause({
        listenChannel: this.listenChannel,
        hearFloor: this.hearFloor,
        slots,
      }),
    )
    for (const slot of slots) {
      this.setConsumerPlayback(slot.consumerId, paused.has(slot.consumerId))
    }
  }

  private setConsumerPlayback(consumerId: string, paused: boolean) {
    const consumer = this.consumers.get(consumerId)
    if (!consumer) return
    const currently = this.locallyPausedConsumers.has(consumerId)
    if (paused === currently) return
    if (paused) {
      this.locallyPausedConsumers.add(consumerId)
      consumer.pause()
      this.signal('pauseConsumer', { consumerId })
      return
    }
    this.locallyPausedConsumers.delete(consumerId)
    consumer.resume()
    this.signal('resumeConsumer', { consumerId })
  }

  private async produceMic() {
    if (this.micProducer) return
    const transport = this.requireSendTransport()
    const stream = await this.options.mediaDevices().getUserMedia({ audio: this.micConstraints })
    const track = stream.getAudioTracks()[0]
    if (!track) throw new Error('No microphone found.')
    if (this.micProducer || this.closed || !this.wantMic) {
      stopTrack(track)
      return
    }
    this.micProducer = await transport.produce({
      track,
      codecOptions: { opusStereo: false, opusDtx: true, opusFec: true },
      appData: { source: 'audio' },
    })
    const producer = this.micProducer
    producer.on('trackended', () => {
      if (this.closed || this.micProducer !== producer) return
      this.updateLocal()
      if (
        this.wantMic &&
        !producer.paused &&
        this.snapshot.connection === 'connected' &&
        !trackIsLive(producer.track)
      ) {
        void this.replaceMicTrack(producer, this.micConstraints).catch((error) => this.reportError(error))
      }
    })
    this.updateLocal()
  }

  private async replaceMicTrack(producer: Producer, constraints: MediaTrackConstraints | boolean) {
    if (this.micTrackReplacementInProgress) return
    this.micTrackReplacementInProgress = true
    let track: MediaStreamTrack | undefined
    try {
      const stream = await this.options.mediaDevices().getUserMedia({ audio: constraints })
      track = stream.getAudioTracks()[0]
      if (!track) throw new Error('No microphone found.')
      if (this.micProducer !== producer || this.closed || !this.wantMic) {
        stopTrack(track)
        return
      }
      const previous = producer.track
      await producer.replaceTrack({ track })
      if (this.micProducer !== producer || this.closed) {
        stopTrack(track)
        return
      }
      stopTrack(previous)
      this.updateLocal()
    } catch (error) {
      stopTrack(track)
      throw error
    } finally {
      this.micTrackReplacementInProgress = false
    }
  }

  private cameraConstraints(extra?: MediaTrackConstraints): MediaTrackConstraints {
    return {
      facingMode: this.snapshot.local.cameraFacing,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 },
      ...extra,
    }
  }

  private async produceCamera(extra?: MediaTrackConstraints) {
    if (this.cameraProducer) return
    const transport = this.requireSendTransport()
    const stream = await this.options.mediaDevices().getUserMedia({
      video: this.cameraConstraints(extra),
    })
    const track = stream.getVideoTracks()[0]
    if (!track) throw new Error('No camera found.')
    if (this.cameraProducer || this.closed || !this.wantCamera) {
      stopTrack(track)
      return
    }
    const simulcast = this.options.simulcast !== false
    this.rawCameraTrack = track
    const sent = await this.processCamera(track)
    this.cameraProducer = await transport.produce({
      track: sent,
      encodings: simulcast ? CAMERA_SIMULCAST_ENCODINGS : CAMERA_SINGLE_ENCODING,
      codecOptions: { videoGoogleStartBitrate: 1000 },
      appData: { source: 'video' },
    })
    const cameraProducer = this.cameraProducer
    cameraProducer.on('trackended', () => {
      if (this.closed || this.cameraProducer !== cameraProducer) return
      this.updateLocal()
      if (
        !this.cameraTrackReplacementInProgress &&
        this.wantCamera &&
        this.snapshot.connection === 'connected' &&
        !trackIsLive(cameraProducer.track)
      ) {
        void this.replaceCameraTrack({ facingMode: this.snapshot.local.cameraFacing }).catch((error) =>
          this.reportError(error),
        )
      }
    })
    this.updateLocal()
  }

  /** Run the processor; on failure send the raw camera rather than nothing. */
  private async processCamera(raw: MediaStreamTrack): Promise<MediaStreamTrack> {
    const processor = this.cameraProcessor
    if (!processor) return raw
    try {
      return await processor.start(raw)
    } catch (error) {
      this.reportError(error)
      return raw
    }
  }

  private releaseRawCamera() {
    this.cameraProcessor?.stop()
    stopTrack(this.rawCameraTrack)
    this.rawCameraTrack = null
  }

  private async replaceCameraTrack(extra: MediaTrackConstraints) {
    if (this.cameraTrackReplacement) return this.cameraTrackReplacement
    const replacement = this.performCameraTrackReplacement(extra)
    this.cameraTrackReplacement = replacement
    try {
      await replacement
    } finally {
      if (this.cameraTrackReplacement === replacement) this.cameraTrackReplacement = null
    }
  }

  private async performCameraTrackReplacement(extra: MediaTrackConstraints) {
    const producer = this.cameraProducer
    if (!producer) return
    this.cameraTrackReplacementInProgress = true
    const previous = producer.track
    let track: MediaStreamTrack | undefined
    try {
      // Some phones cannot open two cameras at once.
      this.releaseRawCamera()
      stopTrack(previous)
      const stream = await this.options.mediaDevices().getUserMedia({
        video: this.cameraConstraints(extra),
      })
      track = stream.getVideoTracks()[0]
      if (!track) throw new Error('No camera found.')
      if (this.cameraProducer !== producer || this.closed || !this.wantCamera) {
        stopTrack(track)
        return
      }
      this.rawCameraTrack = track
      const processedTrack = await this.processCamera(track)
      if (this.cameraProducer !== producer || this.closed || !this.wantCamera) {
        if (processedTrack !== track) stopTrack(processedTrack)
        stopTrack(track)
        if (this.rawCameraTrack === track) this.rawCameraTrack = null
        return
      }
      await producer.replaceTrack({ track: processedTrack })
      if (this.cameraProducer !== producer || this.closed) {
        stopTrack(processedTrack)
        stopTrack(track)
        return
      }
      this.updateLocal()
    } catch (error) {
      stopTrack(track)
      if (this.rawCameraTrack === track) this.rawCameraTrack = null
      this.updateLocal()
      throw error
    } finally {
      this.cameraTrackReplacementInProgress = false
    }
  }

  /**
   * Fire-and-forget server call. The mediasoup server only accepts these as
   * protoo notifications; as requests it rejects them as unknown methods, so
   * stopped shares and cameras stayed frozen on everyone else's screen.
   */
  private signal(method: string, data: Record<string, unknown>) {
    this.protoo?.notify(method, data)
  }

  private closeProducer(kind: 'camera' | 'screen') {
    const producer = kind === 'camera' ? this.cameraProducer : this.screenProducer
    if (!producer) return
    if (kind === 'camera') this.cameraProducer = null
    else this.screenProducer = null
    const track = producer.track
    try {
      producer.close()
    } catch {
      // Transport already gone.
    }
    stopTrack(track)
    if (kind === 'camera') this.releaseRawCamera()
    this.signal('closeProducer', { producerId: producer.id })
    if (kind === 'screen' && this.screenAudioProducer) {
      const audio = this.screenAudioProducer
      this.screenAudioProducer = null
      try {
        audio.close()
      } catch {
        // Transport already gone.
      }
      stopTrack(audio.track)
      this.signal('closeProducer', { producerId: audio.id })
    }
    this.updateLocal()
  }

  // ── remote media ────────────────────────────────────────────────────────

  private async handleRequest(method: string, data: unknown): Promise<unknown> {
    if (method === 'newConsumer') {
      return this.enqueue(() => this.consume(data as NewConsumerRequest))
    }
    if (method === 'newDataConsumer') {
      throw new Error('Data channels are not used')
    }
    throw new Error(`Unknown request ${method}`)
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.consumerQueue.then(task, task)
    this.consumerQueue = run.catch(() => {})
    return run
  }

  private async consume(request: NewConsumerRequest) {
    const transport = this.recvTransport
    if (!transport) throw new Error('Not ready to receive media')
    const source = mediasoupSourceOf(request.appData)
    const channelId =
      source === 'interpretation' ? interpretationChannelFromSource(request.appData?.source) : null
    const consumer = await transport.consume<ConsumerAppData>({
      id: request.consumerId ?? request.id ?? '',
      producerId: request.producerId,
      kind: request.kind,
      rtpParameters: request.rtpParameters,
      streamId: `${request.peerId}-${source === 'screensharing' || source === 'screenaudio' ? 'screen' : 'av'}`,
      appData: { peerId: request.peerId, source },
    })
    this.consumers.set(consumer.id, consumer)
    // A dead consumer left in its slot renders as a black tile for good.
    consumer.on('transportclose', () => this.removeConsumer(consumer.id))
    consumer.on('trackended', () => this.removeConsumer(consumer.id))

    const peer = this.peers.get(request.peerId) ?? this.addPeer({ peerId: request.peerId })
    const remote: MediasoupRemoteTrack = {
      consumerId: consumer.id,
      track: consumer.track,
      producerPaused: !!request.producerPaused,
      channelId,
    }
    const slot =
      source === 'audio'
        ? 'audio'
        : source === 'interpretation'
          ? 'interpretation'
          : source === 'screensharing'
            ? 'screen'
            : source === 'screenaudio'
              ? 'screenAudio'
              : 'video'
    this.peers.set(peer.peerId, { ...peer, [slot]: remote })
    this.emitPeers()
    // After our answer is sent, so the server's resume never lands after our pause.
    setTimeout(() => {
      this.applyVisibility()
      this.applyInterpretationMix()
    }, 0)
    return {}
  }

  private removeConsumer(consumerId: string) {
    const consumer = this.consumers.get(consumerId)
    if (consumer) {
      try {
        consumer.close()
      } catch {
        // Already closed.
      }
      this.consumers.delete(consumerId)
    }
    this.locallyPausedConsumers.delete(consumerId)
    this.preferredLayers.delete(consumerId)
    this.patchConsumerSlot(consumerId, () => null)
  }

  private patchConsumerSlot(
    consumerId: string,
    patch: (current: MediasoupRemoteTrack) => MediasoupRemoteTrack | null,
  ) {
    for (const peer of this.peers.values()) {
      for (const slot of ['audio', 'video', 'screen', 'screenAudio', 'interpretation'] as const) {
        const current = peer[slot]
        if (current?.consumerId !== consumerId) continue
        this.peers.set(peer.peerId, { ...peer, [slot]: patch(current) })
        this.emitPeers()
        return
      }
    }
  }

  private applyVisibility() {
    const visible = this.visibleUserIds
    for (const peer of this.peers.values()) {
      const video = peer.video
      if (!video) continue
      const consumer = this.consumers.get(video.consumerId)
      if (!consumer) continue
      const shouldPause = !!visible && !visible.has(peer.userId)
      const paused = this.locallyPausedConsumers.has(consumer.id)
      if (shouldPause === paused) continue
      if (shouldPause) {
        this.locallyPausedConsumers.add(consumer.id)
        consumer.pause()
        this.signal('pauseConsumer', { consumerId: consumer.id })
      } else {
        this.locallyPausedConsumers.delete(consumer.id)
        consumer.resume()
        this.signal('resumeConsumer', { consumerId: consumer.id })
      }
    }
  }

  private handleNotification(method: string, data: unknown) {
    const payload = (data ?? {}) as Record<string, unknown>
    switch (method) {
      case 'newPeer':
        this.addPeer((payload.peer ?? payload) as SerializedPeer)
        return
      case 'peerClosed': {
        const peerId = String(payload.peerId ?? '')
        if (this.peers.delete(peerId)) this.emitPeers()
        return
      }
      case 'peerDisplayNameChanged': {
        const peer = this.peers.get(String(payload.peerId ?? ''))
        if (!peer) return
        this.peers.set(peer.peerId, { ...peer, displayName: String(payload.displayName ?? peer.displayName) })
        this.emitPeers()
        return
      }
      case 'consumerClosed':
        void this.enqueue(async () => this.removeConsumer(String(payload.consumerId ?? '')))
        return
      case 'consumerPaused':
      case 'consumerResumed': {
        const producerPaused = method === 'consumerPaused'
        void this.enqueue(async () =>
          this.patchConsumerSlot(String(payload.consumerId ?? ''), (current) => ({
            ...current,
            producerPaused,
          })),
        )
        return
      }
      case 'activeSpeaker': {
        const peerId = typeof payload.peerId === 'string' ? payload.peerId : null
        if (peerId !== this.snapshot.activeSpeakerPeerId) this.update({ activeSpeakerPeerId: peerId })
        return
      }
      case 'speakingPeers': {
        const volumes = Array.isArray(payload.peerVolumes) ? payload.peerVolumes : []
        const ids = volumes
          .map((entry) => (entry as { peerId?: unknown })?.peerId)
          .filter((id): id is string => typeof id === 'string')
        const current = this.snapshot.speakingPeerIds
        if (ids.length === current.length && ids.every((id, index) => id === current[index])) return
        this.update({ speakingPeerIds: ids })
        return
      }
      case 'moderationForceMute':
        void this.setMicEnabled(false)
        return
      case 'moderationRemoved':
        this.update({ removed: true })
        this.close()
        return
      default:
        // Stats, scores, bandwidth and demo-only messages are not used here.
        return
    }
  }

  private addPeer(serialized: SerializedPeer): MediasoupRemotePeer {
    const peerId = String(serialized.peerId ?? serialized.id ?? '')
    const existing = this.peers.get(peerId)
    const peer: MediasoupRemotePeer = {
      peerId,
      userId: mediasoupPeerUserId(peerId),
      displayName: serialized.displayName?.trim() || existing?.displayName || 'Guest',
      avatarUrl: peerAvatar(serialized) ?? existing?.avatarUrl ?? null,
      audio: existing?.audio ?? null,
      video: existing?.video ?? null,
      screen: existing?.screen ?? null,
      screenAudio: existing?.screenAudio ?? null,
      interpretation: existing?.interpretation ?? null,
    }
    this.peers.set(peerId, peer)
    this.emitPeers()
    return peer
  }

  // ── snapshot ────────────────────────────────────────────────────────────

  reportError(error: unknown) {
    this.update({ error: error instanceof Error ? error.message : String(error) })
  }

  private emitPeers() {
    this.update({ peers: [...this.peers.values()] })
  }

  private updateLocal() {
    const mic = this.micProducer
    const spoken = this.interpretingChannel ? this.interpretationProducer : mic
    const camera = this.cameraProducer
    const screen = this.screenProducer
    this.update({
      local: {
        ...this.snapshot.local,
        micEnabled: !!spoken && !spoken.paused && trackIsLive(spoken.track),
        micTrack: spoken?.track ?? mic?.track ?? null,
        cameraEnabled: !!camera && trackIsLive(camera.track) && trackIsLive(this.rawCameraTrack),
        cameraTrack: camera?.track ?? null,
        cameraRawTrack: camera ? this.rawCameraTrack : null,
        screenSharing: !!screen,
        screenTrack: screen?.track ?? null,
      },
    })
  }

  private update(patch: Partial<MediasoupRoomSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    if (this.emitScheduled) return
    this.emitScheduled = true
    queueMicrotask(() => {
      this.emitScheduled = false
      for (const listener of this.listeners) listener()
    })
  }
}
