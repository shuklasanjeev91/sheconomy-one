/**
 * Fix Android Join crash:
 *   java.lang.IllegalStateException: release() called on an object with refcount < 1
 *   at org.webrtc.VideoProcessor.onFrameCaptured / EglRenderer
 *
 * LiveKit's VideoEffectProcessor only overrides the 1-arg onFrameCaptured.
 * WebRTC's default 2-arg method calls it then releases the adapted frame again,
 * double-freeing TextureBufferImpl when FrameAdaptation is a no-op (common).
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
  'videoEffects',
  'VideoEffectProcessor.java',
)

if (!fs.existsSync(target)) {
  process.exit(0)
}

const MARKER = 'VideoProcessor.applyFrameAdaptationParameters'

let contents = fs.readFileSync(target, 'utf8')
if (contents.includes(MARKER)) {
  process.exit(0)
}

const replacement = `    /**
     * Override the 2-arg WebRTC default. The default implementation calls the
     * 1-arg handler then releases the adapted frame again — which double-frees
     * when adaptation is a no-op and crashes Join / background preview on Android:
     * IllegalStateException: release() called on an object with refcount < 1
     */
    @Override
    public void onFrameCaptured(VideoFrame frame, VideoProcessor.FrameAdaptationParameters parameters) {
        VideoFrame adapted = VideoProcessor.applyFrameAdaptationParameters(frame, parameters);
        if (adapted == null) {
            return;
        }
        onFrameCaptured(adapted);
        // 1-arg handler fully balances retains/releases for \`adapted\`.
        // Do NOT release again here (unlike VideoProcessor's default).
    }

    /**
     * Called just after the frame is captured.
     * Will process the VideoFrame with the help of VideoFrameProcessor and send the processed
     * VideoFrame back to webrtc using onFrame method in VideoSink.
     * @param frame raw VideoFrame received from webrtc.
     */
    @Override
    public void onFrameCaptured(VideoFrame frame) {
        if (mSink == null || frame == null) {
            return;
        }
        frame.retain();
        VideoFrame outputFrame = frame;
        try {
            for (VideoFrameProcessor processor : this.videoFrameProcessors) {
                VideoFrame processed = processor.process(outputFrame, textureHelper);

                if (processed == null) {
                    mSink.onFrame(frame);
                    return;
                }
                // Processor returned a replacement — drop the previous output if it
                // was also a replacement (not the retained capturer frame).
                if (outputFrame != frame) {
                    outputFrame.release();
                }
                outputFrame = processed;
            }

            mSink.onFrame(outputFrame);
        } finally {
            if (outputFrame != null && outputFrame != frame) {
                outputFrame.release();
            }
            frame.release();
        }
    }
}
`

// Match the *method* javadoc (4-space indent), not the file-level class javadoc.
// An unindented /**...*/ pattern previously swallowed `public class VideoEffectProcessor`
// and left methods at top level → javac "class, interface, enum, or record expected" on EAS.
const pattern =
  /    \/\*\*[\s\S]*?Called just after the frame is captured\.[\s\S]*?@Override\s+public void onFrameCaptured\(VideoFrame frame\) \{[\s\S]*\}\s*$/

if (!pattern.test(contents)) {
  console.warn('[patch-webrtc-video-effect-processor] Unexpected VideoEffectProcessor.java shape — skip')
  process.exit(0)
}

contents = contents.replace(pattern, replacement)
fs.writeFileSync(target, contents)
console.log('[patch-webrtc-video-effect-processor] Patched', target)
