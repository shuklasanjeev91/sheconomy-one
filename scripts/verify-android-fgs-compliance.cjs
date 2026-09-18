/**
 * Static checks for Android FGS policy + targetSdk 36.
 *
 * Allowed FGS: mediaProjection only (Co-Work Present).
 * Stripped: phoneCall / microphone / camera / location / CallKeep.
 *
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
if (typeof versionCode !== 'number' || versionCode < 171) {
  warnings.push(`android.versionCode is ${versionCode}; bump to 171+ before Play submit (MediaProjection race fix)`)
}

const perms = appJson.expo?.android?.permissions ?? []
for (const required of [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
]) {
  if (!perms.includes(required)) {
    errors.push(`app.json android.permissions must include ${required} for Present`)
  }
}
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
  errors.push('LiveKit enableScreenShareService must be true on Android for Present')
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
mustInclude(fgsPluginPath, 'FOREGROUND_SERVICE_MEDIA_PROJECTION', 'FGS plugin documents MediaProjection permission')
mustInclude(fgsPluginPath, 'ENABLE_SCREEN_SHARE_SERVICE', 'FGS plugin toggles LiveKit screen-share meta')
mustInclude(fgsPluginPath, 'MediaProjectionService', 'FGS plugin pins MediaProjectionService')
mustInclude(fgsPluginPath, "tools:node", 'FGS compliance plugin uses tools:node=remove')
{
  const fgsSrc = read(fgsPluginPath)
  if (!fgsSrc.includes("'android:value': 'true'") && !fgsSrc.includes('"android:value": "true"')) {
    errors.push('ENABLE_SCREEN_SHARE_SERVICE meta-data must be forced to true')
  }
  // SERVICES_TO_REMOVE must not include the MediaProjection service name as an array entry.
  const servicesBlock = fgsSrc.match(/const SERVICES_TO_REMOVE\s*=\s*\[([\s\S]*?)\]/)
  if (servicesBlock?.[1]?.includes('MediaProjectionService')) {
    errors.push('MediaProjectionService must not be listed in SERVICES_TO_REMOVE')
  }
}

const racePatchPath = path.join(root, 'scripts', 'patch-webrtc-media-projection-notification.cjs')
mustInclude(racePatchPath, 'awaitForegroundReady', 'WebRTC patch waits for MediaProjection FGS')
mustInclude(racePatchPath, 'createScreenStream', 'WebRTC patch gates createScreenStream on FGS ready')

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

  const voiceLines = manifest.split('\n').filter((line) => line.includes('VoiceConnectionService'))
  for (const line of voiceLines) {
    if (!line.includes('tools:node="remove"')) {
      errors.push('VoiceConnectionService must be tools:node=remove only (no live ConnectionService)')
    }
  }

  // MediaProjection must NOT be tools:node=remove
  const mediaServiceRemove = manifest
    .split('\n')
    .filter(
      (line) =>
        line.includes('MediaProjectionService') &&
        (line.includes('tools:node="remove"') || line.includes("tools:node='remove'")),
    )
  if (mediaServiceRemove.length) {
    errors.push('MediaProjectionService must not be tools:node=remove (required for Present)')
  }

  const mediaPermRemove = manifest
    .split('\n')
    .filter(
      (line) =>
        line.includes('FOREGROUND_SERVICE_MEDIA_PROJECTION') &&
        (line.includes('tools:node="remove"') || line.includes("tools:node='remove'")),
    )
  if (mediaPermRemove.length) {
    errors.push(
      'FOREGROUND_SERVICE_MEDIA_PROJECTION must not be tools:node=remove (required for Present)',
    )
  }

  if (!manifest.includes('ENABLE_SCREEN_SHARE_SERVICE') || !/ENABLE_SCREEN_SHARE_SERVICE[^>]*android:value="true"/.test(manifest)) {
    // value may be on next lines in pretty XML — also accept true nearby
    if (!/ENABLE_SCREEN_SHARE_SERVICE[\s\S]{0,120}android:value="true"/.test(manifest)) {
      warnings.push(
        'Merged manifest should set io.livekit.reactnative.expo.ENABLE_SCREEN_SHARE_SERVICE=true (EAS prebuild will apply)',
      )
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

console.log('=== Android FGS / API 36 compliance check (mediaProjection allowed) ===')
for (const warning of warnings) console.warn('WARN:', warning)
for (const error of errors) console.error('ERR:', error)

if (errors.length) {
  console.error(`\nFailed with ${errors.length} error(s).`)
  process.exit(1)
}

console.log('\nOK — Unused FGS stripped; MediaProjection Present enabled; target API 36.')
console.log('Play Console: declare mediaProjection FGS type and attach a Present demo video.')
console.log('See doc/android-play-fgs/README.md')
