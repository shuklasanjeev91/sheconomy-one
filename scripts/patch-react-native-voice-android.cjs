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
