/**
 * Static checks for Google Play FGS + targetSdk 35 compliance before EAS submit.
 * Run: yarn verify:android-fgs
 *
 * Also inspects android/ after prebuild when present.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const appJsonPath = path.join(root, 'app.json')
const callKeepPluginPath = path.join(root, 'plugins', 'withCallKeep.cjs')
const fgsPluginPath = path.join(root, 'plugins', 'withAndroidFgsCompliance.cjs')
const callKeepJava = path.join(
  root,
  'node_modules',
  '@livekit',
  'react-native-callkeep',
  'android',
  'src',
  'main',
  'java',
  'io',
  'wazo',
  'callkeep',
  'VoiceConnectionService.java',
)
const webrtcNotify = path.join(
  root,
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
  'MediaProjectionNotification.java',
)
const mergedManifestCandidates = [
  path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
]

const errors = []
const warnings = []

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function mustInclude(file, needle, label) {
  if (!fs.existsSync(file)) {
    errors.push(`Missing file: ${path.relative(root, file)}`)
    return
  }
  if (!read(file).includes(needle)) {
    errors.push(`${label}: expected "${needle}" in ${path.relative(root, file)}`)
  }
}

function mustNotInclude(file, needle, label) {
  if (!fs.existsSync(file)) return
  if (read(file).includes(needle)) {
    errors.push(`${label}: unexpected "${needle}" in ${path.relative(root, file)}`)
  }
}

const appJson = JSON.parse(read(appJsonPath))
const plugins = appJson.expo?.plugins ?? []

const hasBuildProps = plugins.some(
  (entry) =>
    Array.isArray(entry) &&
    entry[0] === 'expo-build-properties' &&
    entry[1]?.android?.targetSdkVersion === 35 &&
    Number(entry[1]?.android?.compileSdkVersion) >= 36,
)
if (!hasBuildProps) {
  errors.push(
    'app.json must include expo-build-properties with targetSdkVersion 35 and compileSdkVersion >= 36',
  )
}

const hasFgsPlugin = plugins.includes('./plugins/withAndroidFgsCompliance.cjs')
if (!hasFgsPlugin) {
  errors.push('app.json must register ./plugins/withAndroidFgsCompliance.cjs')
}

const versionCode = appJson.expo?.android?.versionCode
if (typeof versionCode !== 'number' || versionCode < 112) {
  warnings.push(`android.versionCode is ${versionCode}; expected >= 112 for Play resubmit`)
}

const perms = appJson.expo?.android?.permissions ?? []
for (const required of [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
]) {
  if (!perms.includes(required)) {
    errors.push(`Missing android permission ${required}`)
  }
}
if (perms.includes('android.permission.FOREGROUND_SERVICE_CAMERA')) {
  errors.push('Do not declare FOREGROUND_SERVICE_CAMERA unless camera FGS type is used')
}
if (perms.includes('android.permission.FOREGROUND_SERVICE_LOCATION')) {
  errors.push('Do not declare FOREGROUND_SERVICE_LOCATION; background location is disabled')
}

mustInclude(callKeepPluginPath, "microphone|phoneCall", 'CallKeep FGS types')
mustNotInclude(callKeepPluginPath, 'camera|microphone|phoneCall', 'CallKeep camera type removed')
mustInclude(fgsPluginPath, 'tools:node', 'FGS compliance plugin removes location service')

if (fs.existsSync(callKeepJava)) {
  mustInclude(callKeepJava, 'IMPORTANCE_DEFAULT', 'CallKeep notification importance patch')
  mustInclude(callKeepJava, 'FOREGROUND_SERVICE_TYPE_PHONE_CALL', 'CallKeep startForeground types patch')
  mustNotInclude(callKeepJava, 'IMPORTANCE_NONE', 'CallKeep must not use IMPORTANCE_NONE')
} else {
  warnings.push('CallKeep Java not found — run yarn install / postinstall patches')
}

if (fs.existsSync(webrtcNotify)) {
  mustInclude(webrtcNotify, 'setOngoing(true)', 'WebRTC screen-share notification ongoing patch')
} else {
  warnings.push('WebRTC MediaProjectionNotification not found — run yarn install')
}

for (const manifestPath of mergedManifestCandidates) {
  if (!fs.existsSync(manifestPath)) {
    warnings.push(
      `No prebuild manifest at ${path.relative(root, manifestPath)} — run prebuild/EAS then re-check`,
    )
    continue
  }
  const manifest = read(manifestPath)
  if (manifest.includes('camera|microphone|phoneCall')) {
    errors.push('Merged manifest still declares camera FGS type on CallKeep')
  }
  if (manifest.trimStart().startsWith('<root')) {
    errors.push(
      'AndroidManifest has invalid <root> wrapper — tools xmlns must be on <manifest>, not the document',
    )
  }
  if (
    manifest.includes('LocationTaskService') &&
    !manifest.includes('tools:node="remove"')
  ) {
    warnings.push(
      'LocationTaskService present in app manifest — ensure tools:node=remove merges correctly in AAB',
    )
  }
  if (!manifest.includes('targetSdkVersion') && !fs.existsSync(path.join(root, 'android', 'gradle.properties'))) {
    warnings.push('Could not confirm targetSdk from app manifest alone; check android/app/build.gradle')
  }
}

const gradlePath = path.join(root, 'android', 'app', 'build.gradle')
if (fs.existsSync(gradlePath)) {
  const gradle = read(gradlePath)
  if (!/targetSdkVersion\s+35|targetSdk\s+35/.test(gradle)) {
    // Expo may inject via rootProject.ext
    const propsPath = path.join(root, 'android', 'gradle.properties')
    const extPath = path.join(root, 'android', 'build.gradle')
    const blob = [gradle, fs.existsSync(propsPath) ? read(propsPath) : '', fs.existsSync(extPath) ? read(extPath) : ''].join(
      '\n',
    )
    if (!/targetSdkVersion\s*=?\s*35|targetSdk\s*=?\s*35/.test(blob)) {
      errors.push('android/ build files do not show targetSdk 35 after prebuild')
    }
  }
}

console.log('=== Android FGS / API 35 compliance check ===')
for (const warning of warnings) console.warn('WARN:', warning)
for (const error of errors) console.error('ERR:', error)

if (errors.length) {
  console.error(`\nFailed with ${errors.length} error(s).`)
  process.exit(1)
}

console.log('\nOK — config and patches look compliant.')
console.log('Next: EAS production AAB → confirm targetSdk=35 in Play Console → resubmit with FGS declaration video.')
console.log('See doc/android-play-fgs/README.md')
