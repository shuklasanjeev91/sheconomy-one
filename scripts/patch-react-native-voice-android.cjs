/**
 * Keep @react-native-voice/voice Android build compatible with modern RN/AndroidX.
 * The published package still references jcenter + com.android.support.
 */
const fs = require('node:fs')
const path = require('node:path')

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native-voice',
  'voice',
  'android',
  'build.gradle',
)

if (!fs.existsSync(target)) {
  process.exit(0)
}

let contents = fs.readFileSync(target, 'utf8')
const original = contents

contents = contents.replace(/\bjcenter\(\)/g, 'mavenCentral()')
contents = contents.replace(
  /compileSdkVersion\s+rootProject\.hasProperty\('compileSdkVersion'\)\s*\?\s*rootProject\.compileSdkVersion\s*:\s*DEFAULT_COMPILE_SDK_VERSION/,
  "compileSdk rootProject.hasProperty('compileSdkVersion') ? rootProject.compileSdkVersion : 35",
)
contents = contents.replace(
  /compileSdk\s+rootProject\.hasProperty\('compileSdkVersion'\)\s*\?\s*rootProject\.compileSdkVersion\s*:\s*DEFAULT_COMPILE_SDK_VERSION/,
  "compileSdk rootProject.hasProperty('compileSdkVersion') ? rootProject.compileSdkVersion : 35",
)
contents = contents.replace(
  /implementation\s+"com\.android\.support:appcompat-v7:\$\{supportVersion\}"/,
  'implementation "androidx.appcompat:appcompat:1.6.1"',
)

if (contents !== original) {
  fs.writeFileSync(target, contents)
  console.log('[patch-react-native-voice-android] Patched', target)
}

// The Android module registers as "RCTVoice". Only iOS strips the RCT prefix
// under the New Architecture, so `NativeModules.Voice` is undefined on Android
// and every Voice.start() throws before reaching SpeechRecognizer.
const voiceRoot = path.join(__dirname, '..', 'node_modules', '@react-native-voice', 'voice')
for (const [rel, from, to] of [
  [
    'dist/index.js',
    'const Voice = react_native_1.NativeModules.Voice;',
    'const Voice = react_native_1.NativeModules.Voice ?? react_native_1.NativeModules.RCTVoice;',
  ],
  [
    'src/index.ts',
    'const Voice = NativeModules.Voice as VoiceModule;',
    'const Voice = (NativeModules.Voice ?? NativeModules.RCTVoice) as VoiceModule;',
  ],
]) {
  const file = path.join(voiceRoot, rel)
  if (!fs.existsSync(file)) continue
  const source = fs.readFileSync(file, 'utf8')
  if (!source.includes(from)) continue
  fs.writeFileSync(file, source.replace(from, to))
  console.log('[patch-react-native-voice-android] Patched', file)
}
