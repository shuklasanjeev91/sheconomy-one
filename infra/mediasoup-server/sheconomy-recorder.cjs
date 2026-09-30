'use strict'

/**
 * Cloud recording for app rooms. Copied next to `server/lib/Server.js` on the
 * mediasoup host; see `Server.patch` and `apply-recorder.sh`.
 *
 * Each producer is consumed over a loopback PlainTransport into its own ffmpeg
 * (`-c copy` → .mkv). On stop, the tracks are composed into one MP4 (camera
 * grid, screen share full-frame on top, all audio mixed), uploaded through a
 * signed URL from the `mediasoup-recording` Supabase function, then deleted.
 *
 * Admin API (Bearer HS256 `{ adm: true, path }` signed with MEDIASOUP_JWT_SECRET):
 *   POST /admin/record/start  { room, recordingId }
 *   POST /admin/record/stop   { recordingId }
 *   POST /admin/record/status { recordingId } → { state, error?, durationSeconds?, sizeBytes? }
 */

const crypto = require('node:crypto')
const dgram = require('node:dgram')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const https = require('node:https')
const path = require('node:path')
const { spawn, execFile } = require('node:child_process')

const RECORDINGS_DIR = process.env.SHECONOMY_RECORDINGS_DIR || '/home/ubuntu/sheconomy-recordings'
const CALLBACK_URL = process.env.SHECONOMY_RECORDING_CALLBACK_URL || ''
const JWT_SECRET = () => process.env.MEDIASOUP_JWT_SECRET || ''

const OUTPUT_WIDTH = 1280
const OUTPUT_HEIGHT = 720
const OUTPUT_FPS = 25
const MAX_GRID_PEERS = 16
const MAX_ACTIVE_RECORDINGS = 2
const MAX_RECORDING_MS = 4 * 60 * 60 * 1000
const MIN_FREE_BYTES_TO_START = 800 * 1024 * 1024
const MIN_FREE_BYTES_WHILE_RECORDING = 350 * 1024 * 1024
const FINISHED_RETENTION_MS = 24 * 60 * 60 * 1000
const CLOCK_SKEW_SECONDS = 60
// Loopback ports: mediasoup's side of each PlainTransport, and ffmpeg's RTP/RTCP pair.
const TRANSPORT_PORT_RANGE = { min: 41000, max: 41999 }
const FFMPEG_PORT_MIN = 42000
const FFMPEG_PORT_MAX = 42998

const log = (...args) => console.log('[sheconomy-recorder]', ...args)
const warn = (...args) => console.warn('[sheconomy-recorder]', ...args)

/** roomId → { router, producers: Map<producerId, Producer> } */
const rooms = new Map()
/** recordingId → Recording */
const recordings = new Map()
let composeChain = Promise.resolve()

// ── room registry ────────────────────────────────────────────────────────────

function registerRoom(room, router) {
  const entry = { router, producers: new Map() }
  rooms.set(room.id, entry)

  router.observer.on('newtransport', (transport) => {
    transport.observer.on('newproducer', (producer) => {
      entry.producers.set(producer.id, producer)
      producer.observer.once('close', () => entry.producers.delete(producer.id))
      for (const rec of recordings.values()) {
        if (rec.roomId === room.id && rec.state === 'recording') {
          rec.addProducer(producer).catch((error) => warn('addProducer failed', rec.id, error.message))
        }
      }
    })
  })

  const onClosed = () => {
    if (rooms.get(room.id) === entry) rooms.delete(room.id)
    for (const rec of recordings.values()) {
      if (rec.roomId === room.id && rec.state === 'recording') rec.stop('room closed')
    }
  }
  room.on('closed', onClosed)
  router.observer.once('close', onClosed)
}

// ── JWT ──────────────────────────────────────────────────────────────────────

function signJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', JWT_SECRET()).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${signature}`
}

function verifyAdminToken(token, adminPath) {
  const secret = JWT_SECRET()
  if (!secret || typeof token !== 'string') return false
  const [header, body, signature] = token.split('.')
  if (!header || !body || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  const actual = Buffer.from(signature, 'base64url')
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false
  let claims
  try {
    if (JSON.parse(Buffer.from(header, 'base64url').toString('utf8')).alg !== 'HS256') return false
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return false
  }
  const now = Math.floor(Date.now() / 1000)
  if (claims.adm !== true || claims.path !== adminPath) return false
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) return false
  return true
}

// ── helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function canBindUdp(port) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4')
    socket.once('error', () => resolve(false))
    socket.bind(port, '127.0.0.1', () => socket.close(() => resolve(true)))
  })
}

const usedFfmpegPorts = new Set()
async function allocateRtpPort() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const span = (FFMPEG_PORT_MAX - FFMPEG_PORT_MIN) / 2
    const port = FFMPEG_PORT_MIN + 2 * Math.floor(Math.random() * span)
    if (usedFfmpegPorts.has(port)) continue
    if ((await canBindUdp(port)) && (await canBindUdp(port + 1))) {
      usedFfmpegPorts.add(port)
      return port
    }
  }
  throw new Error('no free RTP port for the recorder')
}

async function freeDiskBytes(dir) {
  const stats = await fsp.statfs(dir)
  return stats.bavail * stats.bsize
}

function probeStreamTypes(file) {
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file],
      { timeout: 30_000 },
      (error, stdout) => resolve(error ? [] : stdout.split('\n').map((line) => line.trim()).filter(Boolean)),
    )
  })
}

function runFfmpeg(args, label) {
  return new Promise((resolve, reject) => {
    const proc = spawn('nice', ['-n', '15', 'ffmpeg', ...args], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk).slice(-4000)
    })
    proc.once('error', reject)
    proc.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${label} failed (${code}): ${stderr.trim().split('\n').slice(-3).join(' | ')}`))
    })
  })
}

function buildSdp(consumer, port) {
  const codec = consumer.rtpParameters.codecs[0]
  const name = codec.mimeType.split('/')[1]
  const pt = codec.payloadType
  const rtpmap =
    consumer.kind === 'audio' ? `${name}/${codec.clockRate}/${codec.channels || 2}` : `${name}/${codec.clockRate}`
  const fmtp = Object.entries(codec.parameters || {})
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
  return [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=sheconomy-recording',
    'c=IN IP4 127.0.0.1',
    't=0 0',
    `m=${consumer.kind} ${port} RTP/AVP ${pt}`,
    `a=rtcp:${port + 1}`,
    `a=rtpmap:${pt} ${rtpmap}`,
    ...(fmtp ? [`a=fmtp:${pt} ${fmtp}`] : []),
    'a=recvonly',
    '',
  ].join('\n')
}

async function postCallback(recordingId, event, extra = {}) {
  if (!CALLBACK_URL) throw new Error('SHECONOMY_RECORDING_CALLBACK_URL is not set')
  let lastError
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const now = Math.floor(Date.now() / 1000)
      const token = signJwt({ adm: true, rec: recordingId, iat: now, exp: now + 120 })
      const response = await fetch(CALLBACK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'server-event', event, recordingId, token, ...extra }),
        signal: AbortSignal.timeout(30_000),
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.ok !== false) return data
      lastError = new Error(`${event} callback ${response.status}: ${data.error || 'unknown error'}`)
      if (response.status >= 400 && response.status < 500) break
    } catch (error) {
      lastError = error
    }
    await sleep(2000 * (attempt + 1))
  }
  throw lastError
}

function putFile(url, file, size) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      new URL(url),
      {
        method: 'PUT',
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': size, 'x-upsert': 'true' },
      },
      (response) => {
        let body = ''
        response.on('data', (chunk) => {
          body = (body + chunk).slice(-1000)
        })
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) resolve()
          else reject(new Error(`upload failed (${response.statusCode}): ${body.slice(0, 300)}`))
        })
      },
    )
    request.setTimeout(60 * 60 * 1000, () => request.destroy(new Error('upload timed out')))
    request.once('error', reject)
    fs.createReadStream(file).once('error', reject).pipe(request)
  })
}

// ── recording ────────────────────────────────────────────────────────────────

class Track {
  constructor(recording, producer) {
    this.recording = recording
    this.producer = producer
    this.kind = producer.kind
    this.source = producer.appData?.source || producer.kind
    this.peerId = String(producer.appData?.peerId || producer.id)
    this.file = path.join(recording.dir, `${producer.id}.mkv`)
    /** Wall-clock windows (ms) during which the producer was sending. */
    this.windows = []
    this.stopped = false
  }

  get isScreen() {
    return this.kind === 'video' && this.source === 'screensharing'
  }

  openWindow() {
    const last = this.windows[this.windows.length - 1]
    if (!last || last.end !== undefined) this.windows.push({ start: Date.now() })
  }

  closeWindow() {
    const last = this.windows[this.windows.length - 1]
    if (last && last.end === undefined) last.end = Date.now()
  }

  async start(router) {
    this.port = await allocateRtpPort()
    this.transport = await router.createPlainTransport({
      listenInfo: { protocol: 'udp', ip: '127.0.0.1', portRange: TRANSPORT_PORT_RANGE },
      rtcpMux: false,
      comedia: false,
      appData: { sheconomyRecording: this.recording.id },
    })
    await this.transport.connect({ ip: '127.0.0.1', port: this.port, rtcpPort: this.port + 1 })
    this.consumer = await this.transport.consume({
      producerId: this.producer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: true,
    })
    // Cameras land in grid tiles; the middle simulcast layer is plenty and
    // keeps the raw capture small on this disk.
    if (this.kind === 'video' && !this.isScreen && this.consumer.type === 'simulcast') {
      await this.consumer.setPreferredLayers({ spatialLayer: 1, temporalLayer: 2 }).catch(() => {})
    }

    const sdpPath = path.join(this.recording.dir, `${this.producer.id}.sdp`)
    await fsp.writeFile(sdpPath, buildSdp(this.consumer, this.port))
    this.proc = spawn(
      'ffmpeg',
      [
        '-nostdin',
        '-loglevel', 'error',
        '-protocol_whitelist', 'file,udp,rtp',
        '-fflags', '+genpts',
        '-reorder_queue_size', '512',
        '-analyzeduration', '10M',
        '-probesize', '10M',
        '-i', sdpPath,
        '-map', '0',
        '-c', 'copy',
        '-f', 'matroska',
        '-y', this.file,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    )
    this.exited = new Promise((resolve) => this.proc.once('exit', resolve))
    this.proc.stderr.on('data', (chunk) => {
      const line = String(chunk).trim()
      if (line) warn(`ffmpeg ${this.producer.id}:`, line.slice(0, 300))
    })

    this.consumer.on('producerpause', () => this.closeWindow())
    this.consumer.on('producerresume', () => {
      this.openWindow()
      this.requestKeyFrames()
    })
    this.consumer.on('producerclose', () => this.stop())
    this.consumer.on('transportclose', () => this.stop())

    await sleep(600)
    await this.consumer.resume()
    if (!this.consumer.producerPaused) this.openWindow()
    this.requestKeyFrames()
  }

  requestKeyFrames() {
    if (this.kind !== 'video') return
    for (const delay of [300, 1500, 3500, 7000]) {
      setTimeout(() => {
        if (!this.stopped && this.consumer && !this.consumer.closed) this.consumer.requestKeyFrame().catch(() => {})
      }, delay)
    }
  }

  async stop() {
    if (this.stopped) return this.exited
    this.stopped = true
    this.closeWindow()
    // ffmpeg only notices SIGINT between packets, so signal it while media is
    // still flowing; a silent input needs repeated signals (it hard-exits after 3).
    if (this.proc && this.proc.exitCode === null) {
      this.proc.kill('SIGINT')
      const repeatTimer = setTimeout(() => {
        this.proc.kill('SIGINT')
        this.proc.kill('SIGINT')
        this.proc.kill('SIGINT')
      }, 3000)
      const killTimer = setTimeout(() => this.proc.kill('SIGKILL'), 8000)
      await this.exited
      clearTimeout(repeatTimer)
      clearTimeout(killTimer)
    }
    try {
      this.consumer?.close()
    } catch {}
    try {
      this.transport?.close()
    } catch {}
    usedFfmpegPorts.delete(this.port)
  }
}

class Recording {
  constructor({ id, roomId, router }) {
    this.id = id
    this.roomId = roomId
    this.router = router
    this.dir = path.join(RECORDINGS_DIR, id)
    this.state = 'recording'
    this.error = undefined
    this.tracks = new Map()
    this.startedAt = Date.now()
    this.stoppedAt = undefined
    this.durationSeconds = undefined
    this.sizeBytes = undefined
  }

  async begin(producers) {
    await fsp.mkdir(this.dir, { recursive: true })
    await Promise.all([...producers].map((producer) => this.addProducer(producer)))
    this.maxTimer = setTimeout(() => this.stop('maximum length reached'), MAX_RECORDING_MS)
    this.diskTimer = setInterval(async () => {
      const free = await freeDiskBytes(RECORDINGS_DIR).catch(() => Infinity)
      if (free < MIN_FREE_BYTES_WHILE_RECORDING) this.stop('server disk nearly full')
    }, 30_000)
  }

  async addProducer(producer) {
    if (this.state !== 'recording' || producer.closed || this.tracks.has(producer.id)) return
    const track = new Track(this, producer)
    this.tracks.set(producer.id, track)
    try {
      await track.start(this.router)
    } catch (error) {
      warn('track start failed', producer.id, error.message)
      await track.stop().catch(() => {})
      this.tracks.delete(producer.id)
    }
  }

  stop(reason) {
    if (this.state !== 'recording') return
    log('stopping', this.id, reason || '')
    this.state = 'processing'
    this.stoppedAt = Date.now()
    clearTimeout(this.maxTimer)
    clearInterval(this.diskTimer)
    this.finalize().catch(() => {})
  }

  async finalize() {
    try {
      await Promise.all([...this.tracks.values()].map((track) => track.stop()))
      const output = path.join(this.dir, 'recording.mp4')
      composeChain = composeChain.catch(() => {}).then(() => this.compose(output))
      await composeChain
      const { size } = await fsp.stat(output)
      this.sizeBytes = size
      this.state = 'uploading'
      const { uploadUrl } = await postCallback(this.id, 'upload-url')
      if (!uploadUrl) throw new Error('no upload URL returned')
      await putFile(uploadUrl, output, size)
      await postCallback(this.id, 'ready', { durationSeconds: this.durationSeconds, sizeBytes: size })
      this.state = 'ready'
      log('ready', this.id, `${this.durationSeconds}s`, `${size} bytes`)
    } catch (error) {
      this.state = 'failed'
      this.error = String(error?.message || error).slice(0, 400)
      warn('failed', this.id, this.error)
      await postCallback(this.id, 'failed', { error: this.error }).catch((cause) =>
        warn('failed callback error', this.id, cause.message),
      )
    } finally {
      await fsp.rm(this.dir, { recursive: true, force: true }).catch(() => {})
      setTimeout(() => recordings.delete(this.id), FINISHED_RETENTION_MS).unref()
    }
  }

  async compose(output) {
    const durationMs = Math.max(1000, this.stoppedAt - this.startedAt)
    const duration = durationMs / 1000
    this.durationSeconds = Math.round(duration)
    const seconds = (ms) => Math.max(0, (ms - this.startedAt) / 1000).toFixed(3)

    const usable = []
    for (const track of this.tracks.values()) {
      if (!track.windows.length) continue
      const exists = await fsp.stat(track.file).then((s) => s.size > 0, () => false)
      if (!exists) continue
      const types = await probeStreamTypes(track.file)
      if (types.includes(track.kind)) usable.push(track)
    }

    const inputs = []
    const filters = []
    const inputIndex = (track) => {
      inputs.push('-i', track.file)
      return inputs.length / 2 - 1
    }

    filters.push(
      `color=c=0x1c1c1e:s=${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}:r=${OUTPUT_FPS}:d=${duration.toFixed(3)}[base0]`,
    )
    let base = 'base0'
    let overlayCount = 0
    const overlay = (label, x, y, windows) => {
      const enable = windows
        .map((w) => `between(t,${seconds(w.start)},${seconds(w.end ?? this.stoppedAt)})`)
        .join('+')
      const next = `base${++overlayCount}`
      filters.push(`[${base}][${label}]overlay=x=${x}:y=${y}:eof_action=pass:enable='${enable}'[${next}]`)
      base = next
    }

    const videoTracks = usable.filter((track) => track.kind === 'video')
    const cameraTracks = videoTracks.filter((track) => !track.isScreen)
    const screenTracks = videoTracks.filter((track) => track.isScreen)

    const peers = [...new Set(cameraTracks.map((track) => track.peerId))].slice(0, MAX_GRID_PEERS)
    const cols = Math.max(1, Math.ceil(Math.sqrt(peers.length)))
    const rows = Math.max(1, Math.ceil(peers.length / cols))
    const tileW = Math.floor(OUTPUT_WIDTH / cols / 2) * 2
    const tileH = Math.floor(OUTPUT_HEIGHT / rows / 2) * 2
    const gridTop = Math.floor((OUTPUT_HEIGHT - rows * tileH) / 2)

    for (const track of cameraTracks) {
      const slot = peers.indexOf(track.peerId)
      if (slot < 0) continue
      const row = Math.floor(slot / cols)
      const inRow = row === rows - 1 ? peers.length - row * cols : cols
      const x = Math.floor((OUTPUT_WIDTH - inRow * tileW) / 2) + (slot % cols) * tileW
      const y = gridTop + row * tileH
      const index = inputIndex(track)
      const label = `v${index}`
      filters.push(
        `[${index}:v]setpts=PTS-STARTPTS+${seconds(track.windows[0].start)}/TB,` +
          `scale=${tileW}:${tileH}:force_original_aspect_ratio=decrease,` +
          `pad=${tileW}:${tileH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[${label}]`,
      )
      overlay(label, x, y, track.windows)
    }

    for (const track of screenTracks) {
      const index = inputIndex(track)
      const label = `v${index}`
      filters.push(
        `[${index}:v]setpts=PTS-STARTPTS+${seconds(track.windows[0].start)}/TB,` +
          `scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease,` +
          `pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[${label}]`,
      )
      overlay(label, 0, 0, track.windows)
    }
    filters.push(`[${base}]format=yuv420p[vout]`)

    const audioLabels = []
    for (const track of usable.filter((t) => t.kind === 'audio')) {
      const index = inputIndex(track)
      const delayMs = Math.round(Number(seconds(track.windows[0].start)) * 1000)
      const label = `a${index}`
      filters.push(
        `[${index}:a]asetpts=PTS-STARTPTS,aresample=48000:async=1000,` +
          `aformat=sample_rates=48000:channel_layouts=stereo,adelay=${delayMs}:all=1[${label}]`,
      )
      audioLabels.push(`[${label}]`)
    }
    if (audioLabels.length === 0) {
      filters.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${duration.toFixed(3)}[aout]`)
    } else if (audioLabels.length === 1) {
      filters.push(`${audioLabels[0]}alimiter=limit=0.95[aout]`)
    } else {
      filters.push(
        `${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0:normalize=0,` +
          `alimiter=limit=0.95[aout]`,
      )
    }

    log('composing', this.id, `${usable.length} tracks`, `${duration.toFixed(0)}s`)
    await runFfmpeg(
      [
        '-nostdin',
        '-loglevel', 'error',
        '-y',
        ...inputs,
        '-filter_complex', filters.join(';'),
        '-map', '[vout]',
        '-map', '[aout]',
        '-t', duration.toFixed(3),
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '27',
        '-r', String(OUTPUT_FPS),
        '-g', String(OUTPUT_FPS * 2),
        '-threads', '2',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-movflags', '+faststart',
        output,
      ],
      'compose',
    )
  }
}

async function startRecording({ room: roomId, recordingId }) {
  if (typeof recordingId !== 'string' || !/^[\w-]{8,64}$/.test(recordingId)) {
    return [400, { error: 'Invalid recordingId.' }]
  }
  const existing = recordings.get(recordingId)
  if (existing) return [200, { ok: true, state: existing.state }]

  const entry = rooms.get(roomId)
  if (!entry || entry.router.closed) {
    return [404, { error: 'The meeting room is not active on the media server. Rejoin and try again.' }]
  }
  const active = [...recordings.values()].filter((rec) => ['recording', 'processing', 'uploading'].includes(rec.state))
  if (active.length >= MAX_ACTIVE_RECORDINGS) {
    return [503, { error: 'The recording server is busy. Please try again in a few minutes.' }]
  }
  await fsp.mkdir(RECORDINGS_DIR, { recursive: true })
  if ((await freeDiskBytes(RECORDINGS_DIR)) < MIN_FREE_BYTES_TO_START) {
    return [503, { error: 'The recording server is low on disk space.' }]
  }

  const rec = new Recording({ id: recordingId, roomId, router: entry.router })
  recordings.set(recordingId, rec)
  try {
    await rec.begin(entry.producers.values())
  } catch (error) {
    rec.state = 'failed'
    rec.error = error.message
    clearTimeout(rec.maxTimer)
    clearInterval(rec.diskTimer)
    await Promise.all([...rec.tracks.values()].map((track) => track.stop().catch(() => {})))
    await fsp.rm(rec.dir, { recursive: true, force: true }).catch(() => {})
    return [500, { error: `Could not start recording: ${error.message}` }]
  }
  log('started', recordingId, roomId, `${rec.tracks.size} tracks`)
  return [200, { ok: true, state: rec.state }]
}

function recordingStatus(rec) {
  return {
    ok: true,
    state: rec.state,
    ...(rec.error ? { error: rec.error } : {}),
    ...(rec.durationSeconds !== undefined ? { durationSeconds: rec.durationSeconds } : {}),
    ...(rec.sizeBytes !== undefined ? { sizeBytes: rec.sizeBytes } : {}),
  }
}

// ── admin HTTP ───────────────────────────────────────────────────────────────

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > limit) {
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(data))
}

/** Returns true when the request was an `/admin/record/*` call and has been answered. */
function handleAdminRequest(req, res) {
  const url = req.url || ''
  if (!url.startsWith('/admin/record/')) return false
  const adminPath = url.slice('/admin/'.length).split('?')[0]

  if (req.method !== 'POST') {
    send(res, 405, { error: 'Method not allowed.' })
    return true
  }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!verifyAdminToken(token, adminPath)) {
    send(res, 401, { error: 'Unauthorized.' })
    return true
  }

  readJson(req)
    .then(async (body) => {
      if (adminPath === 'record/start') {
        const [status, data] = await startRecording(body)
        return send(res, status, data)
      }
      const rec = recordings.get(String(body.recordingId || ''))
      if (adminPath === 'record/stop') {
        if (!rec) return send(res, 404, { error: 'Recording not found.' })
        rec.stop('stopped by host')
        return send(res, 200, recordingStatus(rec))
      }
      if (adminPath === 'record/status') {
        if (!rec) return send(res, 404, { error: 'Recording not found.' })
        return send(res, 200, recordingStatus(rec))
      }
      return send(res, 404, { error: 'Unknown admin path.' })
    })
    .catch((error) => send(res, 400, { error: error.message }))
  return true
}

module.exports = { registerRoom, handleAdminRequest }
