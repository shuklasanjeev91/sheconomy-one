/**
 * Align Android foreground-service declarations with real usage for Play policy:
 * - CallKeep VoiceConnectionService: microphone|phoneCall only (no unused camera type)
 * - Strip expo-location LocationTaskService (background location is disabled)
 * - Ensure MediaProjection / call FGS permissions stay declared without extras
 */
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
} = require('@expo/config-plugins')

const CALLKEEP_SERVICE = 'io.wazo.callkeep.VoiceConnectionService'
const LOCATION_TASK_SERVICE = 'expo.modules.location.services.LocationTaskService'

function ensureToolsNamespace(manifest) {
  if (!manifest.$) manifest.$ = {}
  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools'
  }
}

function removeServiceByName(application, name) {
  if (!application.service) return
  application.service = application.service.filter((service) => service?.$?.['android:name'] !== name)
}

function withAndroidFgsCompliance(config) {
  return withAndroidManifest(config, (mod) => {
    const androidManifest = mod.modResults
    ensureToolsNamespace(androidManifest)

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest)

    // Background location is off in app.json — do not ship a location FGS type.
    removeServiceByName(application, LOCATION_TASK_SERVICE)
    if (!application.service) application.service = []
    application.service.push({
      $: {
        'android:name': LOCATION_TASK_SERVICE,
        'tools:node': 'remove',
      },
    })

    // Force CallKeep ConnectionService types to match declared FGS permissions.
    if (application.service) {
      for (const service of application.service) {
        if (service?.$?.['android:name'] === CALLKEEP_SERVICE) {
          service.$['android:foregroundServiceType'] = 'microphone|phoneCall'
        }
      }
    }

    return mod
  })
}

module.exports = createRunOncePlugin(
  withAndroidFgsCompliance,
  'withAndroidFgsCompliance',
  '1.0.0',
)
