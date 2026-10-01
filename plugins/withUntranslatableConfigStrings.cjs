/**
 * Marks Expo config values in res/values/strings.xml as translatable="false".
 *
 * Google Play builds per-language splits from translatable strings. A stale
 * `config.en` split once carried `expo_runtime_version` = 6.0.8 into a 6.1.0
 * binary, so English-locale phones asked EAS for 6.0.x updates whose JS needs
 * native modules this binary no longer ships, and the app crashed on launch.
 */
const { withStringsXml, createRunOncePlugin } = require('@expo/config-plugins')

const CONFIG_STRING_PATTERN = /^(expo_|ExpoLocalization_)/

function withUntranslatableConfigStrings(config) {
  return withStringsXml(config, (mod) => {
    const strings = mod.modResults?.resources?.string
    if (!Array.isArray(strings)) return mod

    for (const entry of strings) {
      const name = entry?.$?.name
      if (name && CONFIG_STRING_PATTERN.test(name)) {
        entry.$.translatable = 'false'
      }
    }

    const runtimeVersion = config.runtimeVersion
    if (typeof runtimeVersion === 'string' && runtimeVersion) {
      const existing = strings.find((entry) => entry?.$?.name === 'expo_runtime_version')
      if (existing) {
        existing._ = runtimeVersion
      } else {
        strings.push({
          $: { name: 'expo_runtime_version', translatable: 'false' },
          _: runtimeVersion,
        })
      }
    }

    return mod
  })
}

module.exports = createRunOncePlugin(
  withUntranslatableConfigStrings,
  'withUntranslatableConfigStrings',
  '1.0.0',
)
