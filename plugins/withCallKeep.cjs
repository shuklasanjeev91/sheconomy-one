/**
 * Registers Android ConnectionService + permissions for @livekit/react-native-callkeep
 * so incoming calls can use the system in-call / lock-screen UI.
 */
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withInfoPlist,
} = require('@expo/config-plugins')

const SERVICE_NAME = 'io.wazo.callkeep.VoiceConnectionService'
const BG_MESSAGING = 'io.wazo.callkeep.RNCallKeepBackgroundMessagingService'

const ANDROID_PERMISSIONS = [
  'android.permission.CALL_PHONE',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_PHONE_NUMBERS',
  'android.permission.MANAGE_OWN_CALLS',
  // READ_CALL_LOG is a Play-restricted permission (default dialer / SMS apps).
  // VoIP CallKeep works without it; including it blocks production uploads.
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
]

function ensureService(application, service) {
  if (!application.service) application.service = []
  const name = service.$['android:name']
  const existing = application.service.find((s) => s?.$?.['android:name'] === name)
  if (existing) {
    Object.assign(existing.$, service.$)
    if (service['intent-filter']) existing['intent-filter'] = service['intent-filter']
    return
  }
  application.service.push(service)
}

function withCallKeepAndroid(config) {
  // Prefer Expo's permission helper — it writes into <manifest>, not the XML root.
  config = AndroidConfig.Permissions.withPermissions(config, ANDROID_PERMISSIONS)

  return withAndroidManifest(config, (mod) => {
    const androidManifest = mod.modResults
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest)

    ensureService(application, {
      $: {
        'android:name': SERVICE_NAME,
        'android:label': 'SHEconomy',
        'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
        'android:exported': 'true',
        'android:foregroundServiceType': 'camera|microphone|phoneCall',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.telecom.ConnectionService' } }],
        },
      ],
    })

    ensureService(application, {
      $: {
        'android:name': BG_MESSAGING,
        'android:exported': 'true',
      },
    })

    return mod
  })
}

function withCallKeepIos(config) {
  return withInfoPlist(config, (mod) => {
    const modes = new Set(mod.modResults.UIBackgroundModes ?? [])
    modes.add('audio')
    modes.add('voip')
    modes.add('remote-notification')
    mod.modResults.UIBackgroundModes = Array.from(modes)
    return mod
  })
}

function withCallKeep(config) {
  config = withCallKeepAndroid(config)
  config = withCallKeepIos(config)
  return config
}

module.exports = createRunOncePlugin(withCallKeep, 'withCallKeep', '1.0.0')
