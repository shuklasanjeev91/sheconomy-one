/**
 * Registers iOS CallKit-related Info.plist background modes for
 * @livekit/react-native-callkeep.
 *
 * Declares only modes the binary actually uses:
 * - remote-notification: wake for push (OneSignal / meeting invites)
 *
 * Do NOT declare `audio` — Apple Guideline 2.5.4 rejects unused background
 * audio when the app has no music/streaming-style persistent playback.
 * Do NOT declare `voip` — PushKit VoIP pushes are not implemented.
 *
 * Android ConnectionService / phoneCall+microphone FGS types are intentionally
 * NOT registered — Google Play rejected them for this marketplace app. Incoming
 * Android calls use the in-app overlay + push notifications instead.
 */
const { createRunOncePlugin, withInfoPlist } = require('@expo/config-plugins')

function withCallKeepIos(config) {
  return withInfoPlist(config, (mod) => {
    const modes = new Set(mod.modResults.UIBackgroundModes ?? [])
    modes.add('remote-notification')
    modes.delete('audio')
    modes.delete('voip')
    mod.modResults.UIBackgroundModes = Array.from(modes)
    return mod
  })
}

function withCallKeep(config) {
  return withCallKeepIos(config)
}

module.exports = createRunOncePlugin(withCallKeep, 'withCallKeep', '2.2.0')
