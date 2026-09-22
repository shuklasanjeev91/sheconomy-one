/**
 * Static checks for Android FGS policy + targetSdk 36.
 * MediaProjection FGS is required for Android Present. Other FGS types stay stripped.
 * Run: yarn verify:android-fgs
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const appJsonPath = path.join(root, 'app.json')
const callKeepPluginPath = path.join(root, 'plugins', 'withCallKeep.cjs')
const fgsPluginPath = path.join(root, 'plugins', 'withAndroidFgsCompliance.cjs')
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
    entry[1]?.android?.targetSdkVersion === 36 &&
    Number(entry[1]?.android?.compileSdkVersion) >= 36,
)
if (!hasBuildProps) {
  errors.push(
    'app.json must include expo-build-properties with targetSdkVersion 36 and compileSdkVersion >= 36',
  )
}

const fgsPluginIndex = plugins.indexOf('./plugins/withAndroidFgsCompliance.cjs')
if (fgsPluginIndex < 0) {
  errors.push('app.json must register ./plugins/withAndroidFgsCompliance.cjs')
} else if (fgsPluginIndex !== plugins.length - 1) {
  errors.push(
    'withAndroidFgsCompliance.cjs must be the last Expo plugin so tools:node=remove wins over LiveKit/WebRTC merges',
  )
}

const versionCode = appJson.expo?.android?.versionCode
if (typeof versionCode !== 'number' || versionCode < 182) {
  warnings.push(`android.versionCode is ${versionCode}; bump to 182+ before Play Present resubmit`)
}

const perms = appJson.expo?.android?.permissions ?? []
for (const forbidden of [
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
  'android.permission.FOREGROUND_SERVICE_CAMERA',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android.permission.MANAGE_OWN_CALLS',
  'android.permission.CALL_PHONE',
  'android.permission.USE_FULL_SCREEN_INTENT',
]) {
  if (perms.includes(forbidden)) {
    errors.push(`Do not declare ${forbidden} — unused FGS must stay out of the AAB`)
  }
}

const livekitPlugin = plugins.find(
  (entry) => Array.isArray(entry) && entry[0] === '@livekit/react-native-expo-plugin',
)
if (livekitPlugin?.[1]?.android?.enableScreenShareService !== true) {
  errors.push('LiveKit enableScreenShareService must be true on Android')
}

const screenSharePlugin = plugins.find(
  (entry) => Array.isArray(entry) && entry[0] === 'expo-livekit-screen-share',
)
if (
  screenSharePlugin?.[1]?.android?.enableScreenShareService !== true ||
  screenSharePlugin?.[1]?.android?.foregroundServicePermission !== true
) {
  errors.push('expo-livekit-screen-share Android screen-share FGS flags must be true')
}

mustInclude(callKeepPluginPath, 'withCallKeepIos', 'CallKeep is iOS-only')
mustNotInclude(callKeepPluginPath, 'VoiceConnectionService', 'CallKeep must not register Android ConnectionService')
mustInclude(fgsPluginPath, 'FOREGROUND_SERVICE_MEDIA_PROJECTION', 'FGS plugin keeps MediaProjection permission')
mustInclude(fgsPluginPath, 'FOREGROUND_SERVICE_PHONE_CALL', 'FGS plugin strips phoneCall FGS')
mustInclude(fgsPluginPath, "tools:node", 'FGS compliance plugin uses tools:node=remove')
{
  const fgsSrc = read(fgsPluginPath)
  if (fgsSrc.includes('MediaProjectionService')) {
    errors.push('FGS plugin must not strip MediaProjectionService — Android Present needs it')
  }
  if (!fgsSrc.includes("'android:value': 'true'") && !fgsSrc.includes('"android:value": "true"')) {
    errors.push('ENABLE_SCREEN_SHARE_SERVICE meta-data must be true')
  }
}

for (const manifestPath of mergedManifestCandidates) {
  if (!fs.existsSync(manifestPath)) {
    warnings.push(
      `No prebuild manifest at ${path.relative(root, manifestPath)} — run prebuild/EAS then re-check`,
    )
    continue
  }
  const manifest = read(manifestPath)
  if (manifest.trimStart().startsWith('<root')) {
    errors.push(
      'AndroidManifest has invalid <root> wrapper — tools xmlns must be on <manifest>, not the document',
    )
  }
  for (const name of [
    'FOREGROUND_SERVICE_MICROPHONE',
    'FOREGROUND_SERVICE_PHONE_CALL',
    'FOREGROUND_SERVICE_CAMERA',
    'FOREGROUND_SERVICE_LOCATION',
  ]) {
    const lines = manifest.split('\n').filter((line) => line.includes(name))
    for (const line of lines) {
      if (!line.includes('tools:node="remove"') && !line.includes("tools:node='remove'")) {
        errors.push(`Merged manifest still declares ${name} without tools:node=remove`)
      }
    }
  }

  const mediaPermLines = manifest
    .split('\n')
    .filter((line) => line.includes('FOREGROUND_SERVICE_MEDIA_PROJECTION'))
  if (!mediaPermLines.length) {
    warnings.push('Merged manifest has no FOREGROUND_SERVICE_MEDIA_PROJECTION yet — confirm after prebuild')
  }
  for (const line of mediaPermLines) {
    if (line.includes('tools:node="remove"') || line.includes("tools:node='remove'")) {
      errors.push('FOREGROUND_SERVICE_MEDIA_PROJECTION must not be tools:node=remove')
    }
  }

  const voiceLines = manifest.split('\n').filter((line) => line.includes('VoiceConnectionService'))
  for (const line of voiceLines) {
    if (!line.includes('tools:node="remove"')) {
      errors.push('VoiceConnectionService must be tools:node=remove only (no live ConnectionService)')
    }
  }
}

const gradlePath = path.join(root, 'android', 'app', 'build.gradle')
if (fs.existsSync(gradlePath)) {
  const gradle = read(gradlePath)
  const propsPath = path.join(root, 'android', 'gradle.properties')
  const extPath = path.join(root, 'android', 'build.gradle')
  const blob = [
    gradle,
    fs.existsSync(propsPath) ? read(propsPath) : '',
    fs.existsSync(extPath) ? read(extPath) : '',
  ].join('\n')
  if (!/targetSdkVersion\s*=?\s*36|targetSdk\s*=?\s*36/.test(blob)) {
    warnings.push(
      'Local android/ build files do not show targetSdk 36 — regenerate with prebuild/EAS before comparing',
    )
  }
}

console.log('=== Android FGS / API 36 compliance check (MediaProjection Present only) ===')
for (const warning of warnings) console.warn('WARN:', warning)
for (const error of errors) console.error('ERR:', error)

if (errors.length) {
  console.error(`\nFailed with ${errors.length} error(s).`)
  process.exit(1)
}

console.log('\nOK — Unused FGS types stripped; MediaProjection Present enabled; target API 36.')
console.log('Play Console: declare mediaProjection only (user-initiated screen share).')
console.log('See doc/android-play-fgs/README.md')
