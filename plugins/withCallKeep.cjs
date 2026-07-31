/**
 * Registers iOS CallKit background modes for @livekit/react-native-callkeep.
 *
 * Android ConnectionService / phoneCall+microphone FGS types are intentionally
 * NOT registered — Google Play rejected them for this marketplace app. Incoming
 * Android calls use the in-app overlay + push notifications instead.
 */
const { createRunOncePlugin, withInfoPlist } = require('@expo/config-plugins')

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
  return withCallKeepIos(config)
}

module.exports = createRunOncePlugin(withCallKeep, 'withCallKeep', '2.0.0')
