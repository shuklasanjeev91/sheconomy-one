/**
 * Fix Android Camera2 freeze:
 *   Camera freezed — Client must return video buffers
 *
 * GetUserMediaImpl.setVideoEffects treated an empty ReadableArray as "install
 * VideoEffectProcessor with no processors". That wrapper still sits on the
 * capturer path and eventually stalls Camera2 (EglRenderer Frames received: 0).
 *
 * Empty / null must remove the VideoProcessor entirely.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@livekit',
  'react-native-webrtc',
  'android',
  'src',
  'main',
  'java',
  'com',
  'oney',
  'WebRTCModule',
  'GetUserMediaImpl.java',
)

if (!fs.existsSync(target)) process.exit(0)

const MARKER = 'names.size() == 0'
let contents = fs.readFileSync(target, 'utf8')
if (contents.includes(MARKER)) process.exit(0)

const needle = `            if (names != null) {
                List<VideoFrameProcessor> processors =
                        names.toArrayList()
                                .stream()
                                .filter(name -> name instanceof String)
                                .map(name -> {
                                    VideoFrameProcessor videoFrameProcessor =
                                            ProcessorProvider.getProcessor((String) name);
                                    if (videoFrameProcessor == null) {
                                        Log.e(TAG, "no videoFrameProcessor associated with this name: " + name);
                                    }
                                    return videoFrameProcessor;
                                })
                                .filter(Objects::nonNull)
                                .collect(Collectors.toList());

                VideoEffectProcessor videoEffectProcessor = new VideoEffectProcessor(processors, surfaceTextureHelper);
                videoSource.setVideoProcessor(videoEffectProcessor);

            } else {
                videoSource.setVideoProcessor(null);
            }`

const replacement = `            // Empty array must CLEAR the processor. Installing VideoEffectProcessor([])
            // freezes Camera2 on Samsung / Adreno ("Client must return video buffers").
            if (names != null && names.size() > 0) {
                List<VideoFrameProcessor> processors =
                        names.toArrayList()
                                .stream()
                                .filter(name -> name instanceof String)
                                .map(name -> {
                                    VideoFrameProcessor videoFrameProcessor =
                                            ProcessorProvider.getProcessor((String) name);
                                    if (videoFrameProcessor == null) {
                                        Log.e(TAG, "no videoFrameProcessor associated with this name: " + name);
                                    }
                                    return videoFrameProcessor;
                                })
                                .filter(Objects::nonNull)
                                .collect(Collectors.toList());

                if (processors.isEmpty()) {
                    videoSource.setVideoProcessor(null);
                } else {
                    VideoEffectProcessor videoEffectProcessor =
                            new VideoEffectProcessor(processors, surfaceTextureHelper);
                    videoSource.setVideoProcessor(videoEffectProcessor);
                }
            } else {
                videoSource.setVideoProcessor(null);
            }`

if (!contents.includes('if (names != null)')) {
  console.warn('[patch-webrtc-set-video-effects-clear] Unexpected GetUserMediaImpl.java — skip')
  process.exit(0)
}

if (!contents.includes(needle)) {
  // Fallback: smaller surgical replace
  const shortNeedle = 'if (names != null) {'
  const idx = contents.indexOf(shortNeedle)
  if (idx < 0 || !contents.includes('videoSource.setVideoProcessor(videoEffectProcessor)')) {
    console.warn('[patch-webrtc-set-video-effects-clear] Could not locate setVideoEffects block — skip')
    process.exit(0)
  }
}

if (contents.includes(needle)) {
  contents = contents.replace(needle, replacement)
} else {
  console.warn('[patch-webrtc-set-video-effects-clear] Exact block mismatch — skip')
  process.exit(0)
}

fs.writeFileSync(target, contents)
console.log('[patch-webrtc-set-video-effects-clear] Patched', target)
