/**
 * Android 11+ package visibility hides RecognitionService providers unless the
 * manifest declares a <queries> intent for them. Without it SpeechRecognizer
 * cannot bind Google's recognizer, so @react-native-voice/voice never starts
 * and meeting live captions are never published from Android.
 */
const { createRunOncePlugin, withAndroidManifest } = require('@expo/config-plugins')

const RECOGNITION_SERVICE = 'android.speech.RecognitionService'

function hasRecognitionQuery(queries) {
  return queries.some((query) =>
    (query.intent ?? []).some((intent) =>
      (intent.action ?? []).some((action) => action.$?.['android:name'] === RECOGNITION_SERVICE),
    ),
  )
}

const withSpeechRecognitionQueries = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    manifest.queries = manifest.queries ?? []
    if (!hasRecognitionQuery(manifest.queries)) {
      manifest.queries.push({
        intent: [{ action: [{ $: { 'android:name': RECOGNITION_SERVICE } }] }],
      })
    }
    return config
  })

module.exports = createRunOncePlugin(
  withSpeechRecognitionQueries,
  'with-speech-recognition-queries',
  '1.0.0',
)
