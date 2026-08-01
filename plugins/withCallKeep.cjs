/**
 * Registers iOS CallKit background modes for @livekit/react-native-callkeep.
 *
 * Declares only modes the binary actually uses:
 * - audio: keep LiveKit call audio while the user backgrounds the app
 * - remote-notification: wake for push (OneSignal / meeting invites)
 *
 * Do NOT declare `voip` here — PushKit VoIP pushes are not implemented, and
 * Apple Guideline 2.5.4 rejects unused VoIP background mode.
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
    modes.add('remote-notification')
    modes.delete('voip')
    mod.modResults.UIBackgroundModes = Array.from(modes)
    return mod
  })
}

function withCallKeep(config) {
  return withCallKeepIos(config)
}

module.exports = createRunOncePlugin(withCallKeep, 'withCallKeep', '2.1.0')
