/**
 * Keeps the expo-updates runtime version out of Play's per-language splits.
 *
 * Google Play builds `config.<lang>` splits from string resources. A stale
 * `config.en` split once carried `expo_runtime_version` = 6.0.8 into a 6.1.0
 * binary, so English-locale phones asked EAS for 6.0.x updates whose JS needs
 * native modules this binary no longer ships, and the app crashed on launch.
 *
 * The manifest only lives in the base APK, so the runtime meta-data is written
 * as a literal there instead of `@string/expo_runtime_version`. Compiled
 * resources drop `translatable`, so marking the strings is only a hint.
 */
const {
  AndroidConfig,
  withAndroidManifest,
  withStringsXml,
  createRunOncePlugin,
} = require('@expo/config-plugins')

const CONFIG_STRING_PATTERN = /^(expo_|ExpoLocalization_)/
const RUNTIME_META_DATA = 'expo.modules.updates.EXPO_RUNTIME_VERSION'

function withUntranslatableConfigStrings(config) {
  config = withStringsXml(config, (mod) => {
    const strings = mod.modResults?.resources?.string
    if (!Array.isArray(strings)) return mod

    for (const entry of strings) {
      const name = entry?.$?.name
      if (name && CONFIG_STRING_PATTERN.test(name)) {
        entry.$.translatable = 'false'
      }
    }
    return mod
  })

  return withAndroidManifest(config, (mod) => {
    const runtimeVersion = config.runtimeVersion
    if (typeof runtimeVersion !== 'string' || !runtimeVersion) return mod

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults)
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      RUNTIME_META_DATA,
      runtimeVersion,
    )
    return mod
  })
}

module.exports = createRunOncePlugin(
  withUntranslatableConfigStrings,
  'withUntranslatableConfigStrings',
  '1.1.0',
)
