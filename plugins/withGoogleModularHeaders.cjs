/**
 * Google Sign-In pulls in AppCheckCore (Swift), which requires modular headers
 * on GoogleUtilities + RecaptchaInterop when CocoaPods links as static libraries.
 */
const { createRunOncePlugin, withPodfile } = require('@expo/config-plugins')
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode')

const TAG = 'google-modular-headers'
const NEW_SRC = [
  "  pod 'GoogleUtilities', :modular_headers => true",
  "  pod 'RecaptchaInterop', :modular_headers => true",
].join('\n')

function withGoogleModularHeaders(config) {
  return withPodfile(config, (mod) => {
    const results = mergeContents({
      tag: TAG,
      src: mod.modResults.contents,
      newSrc: NEW_SRC,
      anchor: /use_native_modules!/,
      offset: 0,
      comment: '#',
    })
    if (results.didMerge) {
      mod.modResults.contents = results.contents
    }
    return mod
  })
}

module.exports = createRunOncePlugin(
  withGoogleModularHeaders,
  'with-google-modular-headers',
  '1.0.0',
)
