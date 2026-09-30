/**
 * Registers iOS CallKit-related Info.plist background modes for
 * react-native-callkeep.
 *
 * Declares only modes the binary actually uses:
 * - remote-notification: wake for push (OneSignal / meeting invites)
 * - audio: keeps Co-Work meeting audio and Present (ReplayKit screen share)
 *   running while the presenter switches apps. Without it iOS suspends the
 *   app and the shared screen freezes. App Review (Guideline 2.5.4) needs the
 *   review notes to explain this real-time meeting use.
 *
 * Do NOT declare `picture-in-picture` — it is not a valid UIBackgroundModes
 * value and App Store Connect rejects the IPA (409 VALIDATION_ERROR).
 * AVKit PiP does not require a background mode entry.
 *
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
    modes.add('audio')
    modes.delete('picture-in-picture')
    modes.delete('voip')
    mod.modResults.UIBackgroundModes = Array.from(modes)
    return mod
  })
}

function withCallKeep(config) {
  return withCallKeepIos(config)
}

module.exports = createRunOncePlugin(withCallKeep, 'withCallKeep', '2.4.0')
