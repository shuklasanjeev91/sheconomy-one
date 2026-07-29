/**
 * Dynamic Expo config — keeps app.json as source of truth, but switches
 * OneSignal APS mode for cloud device builds (preview/production need
 * `production` entitlements; local USB installs stay on `development`).
 */
const appJson = require('./app.json')

const profile = process.env.EAS_BUILD_PROFILE || ''
const onesignalMode =
  profile === 'preview' || profile === 'production' ? 'production' : 'development'

const expo = JSON.parse(JSON.stringify(appJson.expo))

// Allow targeting an older store runtime for OTA (e.g. App Store 5.0.14)
// without permanently changing app.json. Used by CI / manual publish:
//   EAS_UPDATE_RUNTIME_VERSION=5.0.14 yarn update:production
if (process.env.EAS_UPDATE_RUNTIME_VERSION) {
  expo.runtimeVersion = process.env.EAS_UPDATE_RUNTIME_VERSION
}

expo.plugins = (expo.plugins || []).map((plugin) => {
  if (Array.isArray(plugin) && plugin[0] === 'onesignal-expo-plugin') {
    return [
      'onesignal-expo-plugin',
      {
        ...(plugin[1] || {}),
        mode: onesignalMode,
      },
    ]
  }
  return plugin
})

module.exports = { expo }
